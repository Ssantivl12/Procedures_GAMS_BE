import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ConfigCacheService } from '../configuration/config-cache.service';
import { CreateProcedureDto } from './dto/create-procedure.dto';
import { UpdateProcedureDto } from './dto/update-procedure.dto';
import { ChangeStatusDto } from './dto/change-status.dto';
import { AssignInspectorDto } from './dto/assign-inspector.dto';
import { QueryProceduresDto } from './dto/query-procedures.dto';
import { CreateCycleDto } from './dto/create-cycle.dto';
import { CloseCycleDto } from './dto/close-cycle.dto';
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
    private readonly cache: ConfigCacheService,
  ) {}

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private get procedureInclude() {
    return {
      procedureType: { select: { id: true, code: true, name: true } },
      caseFile: {
        select: {
          id: true,
          code: true,
          company: {
            select: { id: true, legalName: true, category: true },
          },
        },
      },
      assignedInspector: { select: { id: true, firstName: true, lastName: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true } },
      cycles: { where: { isActive: true }, orderBy: { cycleNumber: 'asc' as Prisma.SortOrder } },
    };
  }

  /**
   * Computes raiStatus at response time — not stored in the DB.
   * Applies only to RAI procedures in CERRADO state.
   */
  private computeRaiStatus(procedure: any): 'VIGENTE' | 'POR_VENCER' | 'VENCIDO' | null {
    if (
      procedure.procedureType?.code !== ProcedureTypeCode.RAI ||
      procedure.currentStatus !== ProcedureStatus.CERRADO ||
      !procedure.expirationDate
    ) {
      return null;
    }
    const today = new Date();
    const exp = new Date(procedure.expirationDate);
    const warn = new Date(exp);
    warn.setDate(warn.getDate() - 90);

    if (today >= exp) return 'VENCIDO';
    if (today >= warn) return 'POR_VENCER';
    return 'VIGENTE';
  }

  /**
   * Derives isOverdue from deadlineDate at response time for accuracy.
   * Falls back to the stored field if deadlineDate is null.
   */
  private computeIsOverdue(procedure: any): boolean {
    if (!procedure.deadlineDate) return procedure.isOverdue ?? false;
    const isTerminal =
      procedure.currentStatus === ProcedureStatus.CERRADO ||
      procedure.currentStatus === ProcedureStatus.ABANDONADO;
    if (isTerminal) return false;
    return new Date() > new Date(procedure.deadlineDate);
  }

  private buildResponse(procedure: any) {
    let daysElapsed = procedure.daysElapsed;
    
    // Dynamic calculation of daysElapsed for active reviews
    if (procedure.reviewStartDate && !procedure.closedAt && procedure.currentStatus === ProcedureStatus.EN_REVISION) {
      daysElapsed = this.cache.countWorkingDays(new Date(procedure.reviewStartDate), new Date());
    }

    return {
      ...procedure,
      daysElapsed,
      raiStatus: this.computeRaiStatus(procedure),
      isOverdue: this.computeIsOverdue(procedure),
    };
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

  /**
   * Looks up the deadline in days for a given procedure type and cycle count.
   * cycleCount is the value BEFORE incrementing (matches DeadlineConfig.cycleNumber).
   * Falls back to the highest configured re-entry deadline if no exact match.
   */
  private async getDeadlineDays(
    typeCode: ProcedureTypeCode,
    cycleCount: number,
  ): Promise<number | null> {
    let config = await this.prisma.deadlineConfig.findFirst({
      where: { procedureType: typeCode, cycleNumber: cycleCount, isActive: true },
    });

    // If no exact match for a re-entry cycle, fall back to the highest configured re-entry
    if (!config && cycleCount > 0) {
      config = await this.prisma.deadlineConfig.findFirst({
        where: { procedureType: typeCode, cycleNumber: { gt: 0 }, isActive: true },
        orderBy: { cycleNumber: 'desc' },
      });
    }

    return config?.deadlineDays ?? null;
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

    // 4. RAI requirement for MAI_PMA
    if (procedureType.code === ProcedureTypeCode.MAI_PMA) {
      const raiClosed = await this.prisma.procedure.findFirst({
        where: {
          caseFileId: dto.caseFileId,
          procedureType: { code: ProcedureTypeCode.RAI },
          currentStatus: ProcedureStatus.CERRADO,
          isActive: true,
        },
      });
      if (!raiClosed) {
        throw new ConflictException(PROCEDURE_MESSAGES.ERROR.MAI_PMA_REQUIRES_RAI);
      }
    }

    // 5. RAI and MAI_PMA requirement for IAA
    if (procedureType.code === ProcedureTypeCode.IAA) {
      const [raiClosed, maiPmaClosed] = await Promise.all([
        this.prisma.procedure.findFirst({
          where: {
            caseFileId: dto.caseFileId,
            procedureType: { code: ProcedureTypeCode.RAI },
            currentStatus: ProcedureStatus.CERRADO,
            isActive: true,
          },
        }),
        this.prisma.procedure.findFirst({
          where: {
            caseFileId: dto.caseFileId,
            procedureType: { code: ProcedureTypeCode.MAI_PMA },
            currentStatus: ProcedureStatus.CERRADO,
            isActive: true,
          },
        }),
      ]);

      if (!raiClosed || !maiPmaClosed) {
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

    // 7. Create within transaction + initial ProcedureAudit (RECIBIDO)
    const procedure = await this.prisma.$transaction(async (tx) => {
      const created = await tx.procedure.create({
        data: {
          caseFileId: dto.caseFileId,
          procedureTypeId: dto.procedureTypeId,
          procedureKind: dto.procedureKind,
          receptionDate: new Date(dto.receptionDate),
          routeSheetNumber: dto.routeSheetNumber ?? null,
          companyStatus: dto.companyStatus ?? null,
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
        { approvalCertificate: { contains: search, mode: 'insensitive' } },
        { caseFile: { company: { legalName: { contains: search, mode: 'insensitive' } } } },
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

    const [total, pending] = await Promise.all([
      this.prisma.observation.count({ where: { procedureId: id, isActive: true } }),
      this.prisma.observation.count({
        where: { procedureId: id, isActive: true, isResolved: false },
      }),
    ]);

    return {
      ...this.buildResponse(procedure),
      observationsSummary: { total, pending, resolved: total - pending },
    };
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
    if (dto.companyStatus !== undefined) data.companyStatus = dto.companyStatus;
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
      include: {
        procedureType: { select: { code: true, allowsObservations: true, allowsReentry: true } },
      },
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

      // Check procedure type flags dynamically (contract Configuration §4.5)
      if (
        toStatus === ProcedureStatus.OBSERVADO_PENDIENTE_RECOJO &&
        !procedure.procedureType.allowsObservations
      ) {
        throw new UnprocessableEntityException(PROCEDURE_MESSAGES.ERROR.OBSERVATIONS_NOT_ALLOWED);
      }
      if (
        toStatus === ProcedureStatus.SUBSANACION_PENDIENTE_REINGRESO &&
        !procedure.procedureType.allowsReentry
      ) {
        throw new UnprocessableEntityException(PROCEDURE_MESSAGES.ERROR.REENTRY_NOT_ALLOWED);
      }

      // Role check
      const transitionKey = `${fromStatus}→${toStatus}`;
      const allowedRoles = TRANSITION_ROLES[transitionKey] ?? [];
      if (!this.hasRole(userRoles, allowedRoles)) {
        throw new ForbiddenException(PROCEDURE_MESSAGES.ERROR.FORBIDDEN_TRANSITION);
      }

      // EN_REVISION → OBSERVADO requires at least 1 pending observation in the active cycle
      if (toStatus === ProcedureStatus.OBSERVADO_PENDIENTE_RECOJO) {
        const activeCycle = await this.prisma.procedureCycle.findFirst({
          where: { procedureId: id, closedAt: null, isActive: true },
          orderBy: { cycleNumber: 'desc' },
        });
        const pendingObsCount = await this.prisma.observation.count({
          where: {
            procedureId: id,
            ...(activeCycle ? { cycleId: activeCycle.id } : {}),
            isResolved: false,
            isActive: true,
          },
        });
        if (pendingObsCount === 0) {
          throw new UnprocessableEntityException(
            PROCEDURE_MESSAGES.ERROR.REQUIRES_ACTIVE_OBSERVATION,
          );
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

      if (toStatus === ProcedureStatus.SUBSANACION_PENDIENTE_REINGRESO && !dto.obsPickedDate) {
        throw new UnprocessableEntityException(PROCEDURE_MESSAGES.ERROR.OBS_PICKED_DATE_REQUIRED);
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
    if (toStatus === ProcedureStatus.SUBSANACION_PENDIENTE_REINGRESO) {
      // obsPickedDate is validated above as required for this transition
      const pickDate = new Date(dto.obsPickedDate!);
      // Use DeadlineConfig for cycle 1 (re-entry) as the subsanation deadline
      const subsanDays = await this.getDeadlineDays(procedure.procedureType.code, 1);
      if (subsanDays !== null) {
        updateData.deadlineDate = this.cache.addWorkingDays(pickDate, subsanDays);
      }
      updateData.isOverdue = false;
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

    // Determine if this transition creates a new review cycle
    const isFirstEnRevision =
      fromStatus === ProcedureStatus.RECIBIDO && toStatus === ProcedureStatus.EN_REVISION;

    // re-entry (from SUBSANACION) MUST use createCycle (POST /cycles) as per API Contract
    if (
      fromStatus === ProcedureStatus.SUBSANACION_PENDIENTE_REINGRESO &&
      toStatus === ProcedureStatus.EN_REVISION
    ) {
      throw new UnprocessableEntityException(PROCEDURE_MESSAGES.ERROR.REENTRY_MUST_USE_CYCLES_ENDPOINT);
    }

    // Calculate deadlineDate for all EN_REVISION entries
    let deadlineDate: Date | null = null;
    if (toStatus === ProcedureStatus.EN_REVISION && dto.reviewStartDate) {
      const deadlineDays = await this.getDeadlineDays(
        procedure.procedureType.code,
        procedure.cycleCount, // value before increment
      );
      if (deadlineDays !== null) {
        deadlineDate = this.cache.addWorkingDays(
          new Date(dto.reviewStartDate),
          deadlineDays,
        );
        updateData.deadlineDate = deadlineDate;
        updateData.isOverdue = false; // reset on new cycle
      }
    }

    // Cycle management
    if (isFirstEnRevision) {
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

      // Create ProcedureCycle for first EN_REVISION (#1)
      if (isFirstEnRevision) {
        // Guard: reject if there is already an open (unclosed) cycle (BUG-04)
        const openCycle = await tx.procedureCycle.findFirst({
          where: { procedureId: id, closedAt: null, isActive: true },
        });
        if (openCycle) {
          throw new ConflictException(PROCEDURE_MESSAGES.ERROR.OPEN_CYCLE_EXISTS);
        }

        await tx.procedureCycle.create({
          data: {
            procedureId: id,
            cycleNumber: procedure.cycleCount + 1,
            reentryDate: null,
            reviewDeadline: deadlineDate,
          },
        });
      }

      // Automatically close active cycles on terminal statuses
      if (toStatus === ProcedureStatus.CERRADO || toStatus === ProcedureStatus.ABANDONADO) {
        await tx.procedureCycle.updateMany({
          where: { procedureId: id, closedAt: null, isActive: true },
          data: { closedAt: new Date() },
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

  // ---------------------------------------------------------------------------
  // Cycles — POST /procedures/:id/cycles
  // ---------------------------------------------------------------------------

  async createCycle(procedureId: string, dto: CreateCycleDto, userId: string) {
    const procedure = await this.prisma.procedure.findUnique({
      where: { id: procedureId },
      include: {
        procedureType: { select: { code: true, allowsReentry: true } },
      },
    });
    if (!procedure || !procedure.isActive) {
      throw new NotFoundException(PROCEDURE_MESSAGES.ERROR.NOT_FOUND);
    }

    // autoTransition requires procedure to be in SUBSANACION_PENDIENTE_REINGRESO
    if (dto.autoTransition && procedure.currentStatus !== ProcedureStatus.SUBSANACION_PENDIENTE_REINGRESO) {
      throw new UnprocessableEntityException(PROCEDURE_MESSAGES.ERROR.CYCLE_REQUIRES_SUBSANACION);
    }

    // Check procedure type flag
    if (!procedure.procedureType.allowsReentry) {
      throw new ConflictException(PROCEDURE_MESSAGES.ERROR.REENTRY_NOT_ALLOWED);
    }

    // Guard: reject if there is already an open (unclosed) cycle
    const openCycle = await this.prisma.procedureCycle.findFirst({
      where: { procedureId, closedAt: null, isActive: true },
    });
    if (openCycle) {
      throw new ConflictException(PROCEDURE_MESSAGES.ERROR.OPEN_CYCLE_EXISTS);
    }

    // Guard: enforce maxReentriesAllowed
    if (procedure.reentryCount >= procedure.maxReentriesAllowed) {
      throw new ConflictException(PROCEDURE_MESSAGES.ERROR.MAX_REENTRIES_EXCEEDED);
    }

    const newCycleNumber = procedure.cycleCount + 1;
    const reentryDate = new Date(dto.reentryDate);
    // reviewStartDate defaults to reentryDate if not provided
    const reviewStart = dto.reviewStartDate ? new Date(dto.reviewStartDate) : reentryDate;

    // Calculate reviewDeadline using DeadlineConfig
    const deadlineDays = await this.getDeadlineDays(
      procedure.procedureType.code,
      procedure.cycleCount, // before increment
    );
    let reviewDeadline: Date | null = null;
    if (deadlineDays !== null) {
      reviewDeadline = this.cache.addWorkingDays(reviewStart, deadlineDays);
    }

    const cycle = await this.prisma.$transaction(async (tx) => {
      const created = await tx.procedureCycle.create({
        data: {
          procedureId,
          cycleNumber: newCycleNumber,
          reentryDate,
          reviewDeadline,
          note: dto.note ?? null,
        },
      });

      const updateData: Prisma.ProcedureUpdateInput = {
        cycleCount: { increment: 1 },
        reentryCount: { increment: 1 },
        isOverdue: false,
      };

      if (reviewDeadline !== null) {
        updateData.deadlineDate = reviewDeadline;
      }

      if (dto.autoTransition) {
        updateData.currentStatus = ProcedureStatus.EN_REVISION;
        updateData.reviewStartDate = reviewStart;

        await tx.procedureAudit.create({
          data: {
            procedureId,
            fromStatus: procedure.currentStatus,
            toStatus: ProcedureStatus.EN_REVISION,
            changedByUserId: userId,
          },
        });
      }

      await tx.procedure.update({ where: { id: procedureId }, data: updateData });

      return created;
    });

    await this.auditService.log({
      action: PROCEDURE_AUDIT_ACTIONS.CYCLE_CREATED,
      userId,
      details: { procedureId, cycleNumber: newCycleNumber, autoTransition: dto.autoTransition },
    });

    if (dto.autoTransition) {
      await this.auditService.log({
        action: PROCEDURE_AUDIT_ACTIONS.STATUS_CHANGED,
        userId,
        details: {
          procedureId,
          fromStatus: procedure.currentStatus,
          toStatus: ProcedureStatus.EN_REVISION,
          cycleNumber: newCycleNumber,
        },
      });
    }

    return cycle;
  }

  // ---------------------------------------------------------------------------
  // Cycles — GET /procedures/:id/cycles
  // ---------------------------------------------------------------------------

  async findAllCycles(procedureId: string) {
    const procedure = await this.prisma.procedure.findUnique({ where: { id: procedureId } });
    if (!procedure || !procedure.isActive) {
      throw new NotFoundException(PROCEDURE_MESSAGES.ERROR.NOT_FOUND);
    }

    return this.prisma.procedureCycle.findMany({
      where: { procedureId, isActive: true },
      orderBy: { cycleNumber: 'asc' },
    });
  }

  // ---------------------------------------------------------------------------
  // Cycles — GET /procedures/:id/cycles/:cycleId
  // ---------------------------------------------------------------------------

  async findOneCycle(procedureId: string, cycleId: string) {
    const cycle = await this.prisma.procedureCycle.findFirst({
      where: { id: cycleId, procedureId, isActive: true },
    });
    if (!cycle) {
      throw new NotFoundException(PROCEDURE_MESSAGES.ERROR.CYCLE_NOT_FOUND);
    }
    return cycle;
  }

  // ---------------------------------------------------------------------------
  // Cycles — PATCH /procedures/:id/cycles/:cycleId/close
  // ---------------------------------------------------------------------------

  async closeCycle(procedureId: string, cycleId: string, dto: CloseCycleDto, userId: string) {
    const cycle = await this.prisma.procedureCycle.findFirst({
      where: { id: cycleId, procedureId, isActive: true },
    });
    if (!cycle) {
      throw new NotFoundException(PROCEDURE_MESSAGES.ERROR.CYCLE_NOT_FOUND);
    }
    if (cycle.closedAt !== null) {
      throw new ConflictException(PROCEDURE_MESSAGES.ERROR.CYCLE_ALREADY_CLOSED);
    }

    const updated = await this.prisma.procedureCycle.update({
      where: { id: cycleId },
      data: {
        closedAt: new Date(),
        note: dto.note !== undefined ? dto.note : cycle.note,
      },
    });

    await this.auditService.log({
      action: PROCEDURE_AUDIT_ACTIONS.CYCLE_CLOSED,
      userId,
      details: { procedureId, cycleId },
    });

    return updated;
  }

  // ---------------------------------------------------------------------------
  // Audit — GET /procedures/:id/audit
  // ---------------------------------------------------------------------------

  async getAuditHistory(procedureId: string) {
    const procedure = await this.prisma.procedure.findUnique({ where: { id: procedureId } });
    if (!procedure) {
      throw new NotFoundException(PROCEDURE_MESSAGES.ERROR.NOT_FOUND);
    }

    const audits = await this.prisma.procedureAudit.findMany({
      where: { procedureId },
      orderBy: { changedAt: 'asc' },
      include: {
        changedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    return audits.map((audit) => ({
      id: audit.id,
      procedureId: audit.procedureId,
      fromStatus: audit.fromStatus,
      toStatus: audit.toStatus,
      changedAt: audit.changedAt,
      note: audit.note,
      changedBy: audit.changedBy
        ? {
            id: audit.changedBy.id,
            fullName: `${audit.changedBy.firstName} ${audit.changedBy.lastName}`.trim(),
          }
        : null,
    }));
  }
}
