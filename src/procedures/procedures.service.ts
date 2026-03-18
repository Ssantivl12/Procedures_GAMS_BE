import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateProcedureDto } from './dto/create-procedure.dto';
import { UpdateProcedureDto } from './dto/update-procedure.dto';
import { ChangeStatusDto } from './dto/change-status.dto';
import { AssignInspectorDto } from './dto/assign-inspector.dto';
import { QueryProceduresDto } from './dto/query-procedures.dto';
import { ProcedureStatus, ProcedureTypeCode, CompanyCategory, Prisma } from '@prisma/client';
import { UserRole } from '../common/constants/role.constants';
import {
  PROCEDURE_MESSAGES,
  PROCEDURE_AUDIT_ACTIONS,
  TRANSITIONS_MAP,
  TRANSITION_ROLES,
  ABANDON_ROLES,
  REACTIVATE_ROLES,
  ACTIVE_PROCEDURE_STATUSES_SET,
} from '../common/constants/procedure.constants';

@Injectable()
export class ProceduresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private get procedureInclude() {
    return {
      procedureType: { select: { id: true, code: true, name: true } },
      assignedInspector: { select: { id: true, fullName: true } },
      createdBy: { select: { id: true, fullName: true } },
    };
  }

  private buildResponse(procedure: any) {
    return { ...procedure };
  }

  private validateCategoryCompatibility(typeCode: ProcedureTypeCode, category: CompanyCategory) {
    if (
      category === CompanyCategory.C4 &&
      (typeCode === ProcedureTypeCode.MAI_PMA || typeCode === ProcedureTypeCode.IAA)
    ) {
      throw new ConflictException(PROCEDURE_MESSAGES.ERROR.TYPE_NOT_ALLOWED_FOR_CATEGORY);
    }
  }

  private hasRole(userRoles: string[], roles: UserRole[]): boolean {
    return userRoles.some((r) => roles.includes(r as UserRole));
  }

  // ---------------------------------------------------------------------------
  // create
  // ---------------------------------------------------------------------------

  async create(dto: CreateProcedureDto, userId: string) {
    // 1. CaseFile: exists, active, not closed
    const caseFile = await this.prisma.caseFile.findUnique({
      where: { id: dto.caseFileId },
      include: { company: { select: { category: true } } },
    });
    if (!caseFile || !caseFile.isActive) {
      throw new NotFoundException(PROCEDURE_MESSAGES.ERROR.CASE_FILE_NOT_FOUND);
    }
    if (caseFile.closedAt !== null) {
      throw new ConflictException(PROCEDURE_MESSAGES.ERROR.CASE_FILE_CLOSED);
    }

    // 2. ProcedureType exists
    const procedureType = await this.prisma.procedureType.findUnique({
      where: { id: dto.procedureTypeId },
    });
    if (!procedureType) {
      throw new NotFoundException(PROCEDURE_MESSAGES.ERROR.PROCEDURE_TYPE_NOT_FOUND);
    }

    // 3. Category compatibility
    this.validateCategoryCompatibility(procedureType.code, caseFile.company.category);

    // 4. IAA requires a closed MAI_PMA in the same case file
    if (procedureType.code === ProcedureTypeCode.IAA) {
      const maiPmaClosed = await this.prisma.procedure.findFirst({
        where: {
          caseFileId: dto.caseFileId,
          procedureType: { code: ProcedureTypeCode.MAI_PMA },
          currentStatus: ProcedureStatus.CERRADO,
          isActive: true,
        },
      });
      if (!maiPmaClosed) {
        throw new ConflictException(PROCEDURE_MESSAGES.ERROR.IAA_REQUIRES_MAI_PMA);
      }
    }

    // 5. No active duplicate of the same type
    const activeSameType = await this.prisma.procedure.findFirst({
      where: {
        caseFileId: dto.caseFileId,
        procedureTypeId: dto.procedureTypeId,
        isActive: true,
        currentStatus: {
          notIn: [ProcedureStatus.CERRADO, ProcedureStatus.ABANDONADO],
        },
      },
    });
    if (activeSameType) {
      throw new ConflictException(PROCEDURE_MESSAGES.ERROR.DUPLICATE_ACTIVE_TYPE);
    }

    // 6. RENOVACION requires a prior closed procedure of the same type
    if (dto.procedureKind === 'RENOVACION') {
      const priorClosed = await this.prisma.procedure.findFirst({
        where: {
          caseFileId: dto.caseFileId,
          procedureTypeId: dto.procedureTypeId,
          currentStatus: ProcedureStatus.CERRADO,
          isActive: true,
        },
      });
      if (!priorClosed) {
        throw new ConflictException(PROCEDURE_MESSAGES.ERROR.RENOVACION_REQUIRES_CLOSED);
      }
    }

    // 7. Create within transaction + initial ProcedureAudit
    const procedure = await this.prisma.$transaction(async (tx) => {
      const created = await tx.procedure.create({
        data: {
          caseFileId: dto.caseFileId,
          procedureTypeId: dto.procedureTypeId,
          procedureKind: dto.procedureKind,
          receptionDate: new Date(dto.receptionDate),
          routeSheetNumber: dto.routeSheetNumber ?? null,
          internalFileNumber: dto.internalFileNumber ?? null,
          generalNotes: dto.generalNotes ?? null,
          currentStatus: ProcedureStatus.RECIBIDO,
          cycleCount: 0,
          createdByUserId: userId,
        },
        include: this.procedureInclude,
      });

      await tx.procedureAudit.create({
        data: {
          procedureId: created.id,
          fromStatus: null,
          toStatus: ProcedureStatus.RECIBIDO,
          changedByUserId: userId,
        },
      });

      return created;
    });

    await this.auditService.log({
      action: PROCEDURE_AUDIT_ACTIONS.CREATED,
      userId,
      details: {
        procedureId: procedure.id,
        caseFileId: dto.caseFileId,
        procedureTypeId: dto.procedureTypeId,
      },
    });

    return this.buildResponse(procedure);
  }

  // ---------------------------------------------------------------------------
  // findAll
  // ---------------------------------------------------------------------------

  async findAll(query: QueryProceduresDto) {
    const {
      page = 1,
      limit = 10,
      caseFileId,
      procedureTypeCode,
      procedureKind,
      status,
      assignedInspectorId,
      isOverdue,
      search,
    } = query;

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const skip = (pageNum - 1) * limitNum;

    const where: Prisma.ProcedureWhereInput = { isActive: true };

    if (caseFileId) where.caseFileId = caseFileId;
    if (procedureTypeCode) where.procedureType = { code: procedureTypeCode };
    if (procedureKind) where.procedureKind = procedureKind;
    if (status) where.currentStatus = status;
    if (assignedInspectorId) where.assignedInspectorUserId = assignedInspectorId;
    if (isOverdue === true) where.isOverdue = true;
    if (search) {
      where.OR = [
        { routeSheetNumber: { contains: search, mode: 'insensitive' } },
        { internalFileNumber: { contains: search, mode: 'insensitive' } },
        { approvalCertificate: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.procedure.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        include: this.procedureInclude,
      }),
      this.prisma.procedure.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limitNum);

    return {
      data: items.map((p) => this.buildResponse(p)),
      meta: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages,
        hasNextPage: pageNum < totalPages,
        hasPreviousPage: pageNum > 1,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // findOne
  // ---------------------------------------------------------------------------

  async findOne(id: string) {
    const procedure = await this.prisma.procedure.findUnique({
      where: { id },
      include: this.procedureInclude,
    });
    if (!procedure || !procedure.isActive) {
      throw new NotFoundException(PROCEDURE_MESSAGES.ERROR.NOT_FOUND);
    }
    return this.buildResponse(procedure);
  }

  // ---------------------------------------------------------------------------
  // update (editable fields only)
  // ---------------------------------------------------------------------------

  async update(id: string, dto: UpdateProcedureDto, userId: string) {
    const procedure = await this.prisma.procedure.findUnique({ where: { id } });
    if (!procedure || !procedure.isActive) {
      throw new NotFoundException(PROCEDURE_MESSAGES.ERROR.NOT_FOUND);
    }

    const data: Prisma.ProcedureUpdateInput = {};
    if (dto.routeSheetNumber !== undefined) data.routeSheetNumber = dto.routeSheetNumber;
    if (dto.internalFileNumber !== undefined) data.internalFileNumber = dto.internalFileNumber;
    if (dto.generalNotes !== undefined) data.generalNotes = dto.generalNotes;

    const updated = await this.prisma.procedure.update({
      where: { id },
      data,
      include: this.procedureInclude,
    });

    await this.auditService.log({
      action: PROCEDURE_AUDIT_ACTIONS.UPDATED,
      userId,
      details: { procedureId: id, changes: dto },
    });

    return this.buildResponse(updated);
  }

  // ---------------------------------------------------------------------------
  // changeStatus
  // ---------------------------------------------------------------------------

  async changeStatus(id: string, dto: ChangeStatusDto, userId: string, userRoles: string[]) {
    const procedure = await this.prisma.procedure.findUnique({
      where: { id },
      include: { procedureType: { select: { code: true } } },
    });
    if (!procedure || !procedure.isActive) {
      throw new NotFoundException(PROCEDURE_MESSAGES.ERROR.NOT_FOUND);
    }

    const fromStatus = procedure.currentStatus;
    let toStatus = dto.toStatus;

    // --- Reactivate from ABANDONADO ---
    if (fromStatus === ProcedureStatus.ABANDONADO) {
      if (!this.hasRole(userRoles, REACTIVATE_ROLES)) {
        throw new ForbiddenException(PROCEDURE_MESSAGES.ERROR.FORBIDDEN_TRANSITION);
      }
      const lastAbandoned = await this.prisma.procedureAudit.findFirst({
        where: { procedureId: id, toStatus: ProcedureStatus.ABANDONADO },
        orderBy: { changedAt: 'desc' },
      });
      if (!lastAbandoned?.fromStatus) {
        throw new UnprocessableEntityException(PROCEDURE_MESSAGES.ERROR.INVALID_TRANSITION);
      }
      toStatus = lastAbandoned.fromStatus;
    } else if (toStatus === ProcedureStatus.ABANDONADO) {
      // --- Abandon ---
      if (!ACTIVE_PROCEDURE_STATUSES_SET.includes(fromStatus)) {
        throw new UnprocessableEntityException(PROCEDURE_MESSAGES.ERROR.INVALID_TRANSITION);
      }
      if (!this.hasRole(userRoles, ABANDON_ROLES)) {
        throw new ForbiddenException(PROCEDURE_MESSAGES.ERROR.FORBIDDEN_TRANSITION);
      }
      if (!dto.abandonReason) {
        throw new UnprocessableEntityException(PROCEDURE_MESSAGES.ERROR.ABANDON_REASON_REQUIRED);
      }
    } else {
      // --- Regular transition ---
      const validNext = TRANSITIONS_MAP[fromStatus] ?? [];
      if (!validNext.includes(toStatus)) {
        throw new UnprocessableEntityException(PROCEDURE_MESSAGES.ERROR.INVALID_TRANSITION);
      }

      // CIERRE simplified flow: cannot enter OBSERVADO or SUBSANACION
      if (
        procedure.procedureType.code === ProcedureTypeCode.CIERRE &&
        (toStatus === ProcedureStatus.OBSERVADO_PENDIENTE_RECOJO ||
          toStatus === ProcedureStatus.SUBSANACION_PENDIENTE_REINGRESO)
      ) {
        throw new UnprocessableEntityException(PROCEDURE_MESSAGES.ERROR.CIERRE_SIMPLIFIED_FLOW);
      }

      // Role check
      const transitionKey = `${fromStatus}→${toStatus}`;
      const allowedRoles = TRANSITION_ROLES[transitionKey] ?? [];
      if (!this.hasRole(userRoles, allowedRoles)) {
        throw new ForbiddenException(PROCEDURE_MESSAGES.ERROR.FORBIDDEN_TRANSITION);
      }

      // EN_REVISION → OBSERVADO requires at least 1 active observation
      if (toStatus === ProcedureStatus.OBSERVADO_PENDIENTE_RECOJO) {
        const activeObsCount = await this.prisma.observation.count({
          where: { procedureId: id, isResolved: false, isActive: true },
        });
        if (activeObsCount === 0) {
          throw new ConflictException(PROCEDURE_MESSAGES.ERROR.REQUIRES_ACTIVE_OBSERVATION);
        }
      }

      // Conditional field validation
      if (toStatus === ProcedureStatus.CERRADO) {
        if (!dto.approvalDate) {
          throw new UnprocessableEntityException(PROCEDURE_MESSAGES.ERROR.APPROVAL_DATE_REQUIRED);
        }
        if (!dto.approvalCertificate) {
          throw new UnprocessableEntityException(
            PROCEDURE_MESSAGES.ERROR.APPROVAL_CERTIFICATE_REQUIRED,
          );
        }
        if (procedure.procedureType.code === ProcedureTypeCode.RAI && !dto.expirationDate) {
          throw new UnprocessableEntityException(
            PROCEDURE_MESSAGES.ERROR.EXPIRATION_DATE_REQUIRED,
          );
        }
      }
    }

    // Build update payload
    const updateData: Prisma.ProcedureUpdateInput = { currentStatus: toStatus };

    if (toStatus === ProcedureStatus.ABANDONADO) {
      updateData.abandonReason = dto.abandonReason;
    }
    if (dto.obsPickedDate) {
      updateData.obsPickedDate = new Date(dto.obsPickedDate);
    }
    if (dto.reviewStartDate) {
      updateData.reviewStartDate = new Date(dto.reviewStartDate);
    }
    if (toStatus === ProcedureStatus.CERRADO) {
      updateData.approvalDate = dto.approvalDate ? new Date(dto.approvalDate) : undefined;
      updateData.approvalCertificate = dto.approvalCertificate;
      updateData.expirationDate = dto.expirationDate ? new Date(dto.expirationDate) : undefined;
      updateData.closedAt = new Date();
    }
    // When re-entering from SUBSANACION, increment cycleCount
    if (
      fromStatus === ProcedureStatus.SUBSANACION_PENDIENTE_REINGRESO &&
      toStatus === ProcedureStatus.EN_REVISION
    ) {
      updateData.cycleCount = { increment: 1 };
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const proc = await tx.procedure.update({
        where: { id },
        data: updateData,
        include: this.procedureInclude,
      });

      await tx.procedureAudit.create({
        data: {
          procedureId: id,
          fromStatus,
          toStatus,
          changedByUserId: userId,
          note: dto.note ?? null,
        },
      });

      // Create a new ProcedureCycle on re-entry
      if (
        fromStatus === ProcedureStatus.SUBSANACION_PENDIENTE_REINGRESO &&
        toStatus === ProcedureStatus.EN_REVISION
      ) {
        await tx.procedureCycle.create({
          data: {
            procedureId: id,
            cycleNumber: procedure.cycleCount + 1,
            reentryDate: dto.reviewStartDate ? new Date(dto.reviewStartDate) : new Date(),
          },
        });
      }

      return proc;
    });

    await this.auditService.log({
      action: PROCEDURE_AUDIT_ACTIONS.STATUS_CHANGED,
      userId,
      details: { procedureId: id, fromStatus, toStatus },
    });

    return this.buildResponse(updated);
  }

  // ---------------------------------------------------------------------------
  // assignInspector
  // ---------------------------------------------------------------------------

  async assignInspector(id: string, dto: AssignInspectorDto, userId: string) {
    const procedure = await this.prisma.procedure.findUnique({ where: { id } });
    if (!procedure || !procedure.isActive) {
      throw new NotFoundException(PROCEDURE_MESSAGES.ERROR.NOT_FOUND);
    }

    const inspector = await this.prisma.user.findUnique({
      where: { id: dto.inspectorUserId },
      include: {
        roles: {
          where: { revokedAt: null },
          include: { role: { select: { name: true } } },
        },
      },
    });
    if (!inspector || !inspector.isActive) {
      throw new NotFoundException(PROCEDURE_MESSAGES.ERROR.INSPECTOR_NOT_FOUND);
    }

    const inspectorRoles = inspector.roles.map((ur) => ur.role.name as string);
    const validInspectorRoles: UserRole[] = [
      UserRole.INSPECTOR,
      UserRole.ENCARGADO,
      UserRole.SUPERADMIN,
    ];
    if (!this.hasRole(inspectorRoles, validInspectorRoles)) {
      throw new ForbiddenException(PROCEDURE_MESSAGES.ERROR.INSPECTOR_INVALID_ROLE);
    }

    const updated = await this.prisma.procedure.update({
      where: { id },
      data: { assignedInspectorUserId: dto.inspectorUserId },
      include: this.procedureInclude,
    });

    await this.auditService.log({
      action: PROCEDURE_AUDIT_ACTIONS.ASSIGNED,
      userId,
      details: { procedureId: id, inspectorUserId: dto.inspectorUserId },
    });

    return this.buildResponse(updated);
  }

  // ---------------------------------------------------------------------------
  // remove (soft delete)
  // ---------------------------------------------------------------------------

  async remove(id: string, userId: string) {
    const procedure = await this.prisma.procedure.findUnique({ where: { id } });
    if (!procedure) {
      throw new NotFoundException(PROCEDURE_MESSAGES.ERROR.NOT_FOUND);
    }
    if (!procedure.isActive) {
      throw new ConflictException(PROCEDURE_MESSAGES.ERROR.ALREADY_DELETED);
    }
    if (ACTIVE_PROCEDURE_STATUSES_SET.includes(procedure.currentStatus)) {
      throw new ConflictException(PROCEDURE_MESSAGES.ERROR.CANNOT_DELETE_ACTIVE);
    }

    await this.prisma.procedure.update({
      where: { id },
      data: { isActive: false, deletedAt: new Date() },
    });

    await this.auditService.log({
      action: PROCEDURE_AUDIT_ACTIONS.DELETED,
      userId,
      details: { procedureId: id },
    });

    return { message: PROCEDURE_MESSAGES.SUCCESS.DELETED, id };
  }
}
