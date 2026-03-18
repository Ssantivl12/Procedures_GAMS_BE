import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateCaseFileDto } from './dto/create-case-file.dto';
import { UpdateCaseFileDto } from './dto/update-case-file.dto';
import { QueryCaseFilesDto } from './dto/query-case-files.dto';
import { Prisma, ProcedureStatus } from '@prisma/client';
import {
  CASE_FILE_MESSAGES,
  CASE_FILE_AUDIT_ACTIONS,
  ACTIVE_PROCEDURE_STATUSES,
} from '../common/constants/case-file.constants';

@Injectable()
export class CasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async generateCode(year: number, tx: Prisma.TransactionClient): Promise<string> {
    const pattern = `EXP-${year}-%`;
    const result = await tx.$queryRaw<[{ max_seq: bigint }]>`
      SELECT COALESCE(MAX(CAST(SPLIT_PART(code, '-', 3) AS INT)), 0) AS max_seq
      FROM case_file
      WHERE code LIKE ${pattern}
      FOR UPDATE
    `;
    const next = Number(result[0].max_seq) + 1;
    return `EXP-${year}-${next.toString().padStart(5, '0')}`;
  }

  private buildResponse(caseFile: any) {
    const { procedures = [], company, ...rest } = caseFile;

    const active = procedures.filter((p: any) =>
      (ACTIVE_PROCEDURE_STATUSES as readonly string[]).includes(p.currentStatus),
    ).length;

    const closed = procedures.filter((p: any) =>
      [ProcedureStatus.CERRADO, ProcedureStatus.ABANDONADO].includes(p.currentStatus),
    ).length;

    return {
      ...rest,
      company: company
        ? {
            id: company.id,
            legalName: company.legalName,
            raiNumber: company.raiNumber,
            category: company.category,
          }
        : null,
      proceduresSummary: {
        total: procedures.length,
        active,
        closed,
      },
    };
  }

  private get caseFileInclude() {
    return {
      company: {
        select: {
          id: true,
          legalName: true,
          raiNumber: true,
          category: true,
        },
      },
      procedures: {
        where: { isActive: true },
        select: { currentStatus: true },
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Public methods
  // ---------------------------------------------------------------------------

  async create(dto: CreateCaseFileDto, userId: string) {
    // 1. Verify company exists and is active
    const company = await this.prisma.company.findUnique({
      where: { id: dto.companyId },
    });
    if (!company || !company.isActive) {
      throw new NotFoundException(CASE_FILE_MESSAGES.ERROR.COMPANY_NOT_FOUND);
    }

    // 2. Verify company doesn't already have a case file
    const existing = await this.prisma.caseFile.findUnique({
      where: { companyId: dto.companyId },
    });
    if (existing) {
      throw new ConflictException(CASE_FILE_MESSAGES.ERROR.ALREADY_EXISTS);
    }

    // 3. Verify fileNumber uniqueness if provided
    if (dto.fileNumber) {
      const fileNumberExists = await this.prisma.caseFile.findUnique({
        where: { fileNumber: dto.fileNumber },
      });
      if (fileNumberExists) {
        throw new ConflictException(CASE_FILE_MESSAGES.ERROR.FILE_NUMBER_EXISTS);
      }
    }

    // 4. Generate code and create within a serializable transaction to avoid
    //    concurrent duplicate sequentials
    const year = new Date().getFullYear();

    const caseFile = await this.prisma.$transaction(
      async (tx) => {
        const code = await this.generateCode(year, tx);
        return tx.caseFile.create({
          data: {
            companyId: dto.companyId,
            code,
            fileNumber: dto.fileNumber ?? null,
          },
          include: this.caseFileInclude,
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    await this.auditService.log({
      action: CASE_FILE_AUDIT_ACTIONS.CREATED,
      userId,
      details: { caseFileId: caseFile.id, companyId: dto.companyId, code: caseFile.code },
    });

    return this.buildResponse(caseFile);
  }

  async findAll(query: QueryCaseFilesDto) {
    const {
      page = 1,
      limit = 10,
      search,
      status,
      category,
      isActive = true,
    } = query;

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const skip = (pageNum - 1) * limitNum;

    const where: Prisma.CaseFileWhereInput = { isActive };

    // Filter by open/closed
    if (status === 'open') {
      where.closedAt = null;
    } else if (status === 'closed') {
      where.closedAt = { not: null };
    }

    // Filter by company category (via relation)
    if (category) {
      where.company = { category };
    }

    // Search across code, fileNumber, company.legalName, company.raiNumber
    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { fileNumber: { contains: search, mode: 'insensitive' } },
        { company: { legalName: { contains: search, mode: 'insensitive' } } },
        { company: { raiNumber: { contains: search } } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.caseFile.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { openedAt: 'desc' },
        include: this.caseFileInclude,
      }),
      this.prisma.caseFile.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limitNum);

    return {
      data: items.map((cf) => this.buildResponse(cf)),
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

  async findOne(id: string) {
    const caseFile = await this.prisma.caseFile.findUnique({
      where: { id },
      include: this.caseFileInclude,
    });
    if (!caseFile) {
      throw new NotFoundException(CASE_FILE_MESSAGES.ERROR.NOT_FOUND);
    }
    return this.buildResponse(caseFile);
  }

  async findByCompanyId(companyId: string) {
    const caseFile = await this.prisma.caseFile.findUnique({
      where: { companyId },
      include: this.caseFileInclude,
    });
    if (!caseFile) {
      throw new NotFoundException(CASE_FILE_MESSAGES.ERROR.NOT_FOUND);
    }
    return this.buildResponse(caseFile);
  }

  async update(id: string, dto: UpdateCaseFileDto, userId: string) {
    const caseFile = await this.prisma.caseFile.findUnique({ where: { id } });
    if (!caseFile || !caseFile.isActive) {
      throw new NotFoundException(CASE_FILE_MESSAGES.ERROR.NOT_FOUND);
    }

    if (dto.fileNumber) {
      const duplicate = await this.prisma.caseFile.findFirst({
        where: { fileNumber: dto.fileNumber, id: { not: id } },
      });
      if (duplicate) {
        throw new ConflictException(CASE_FILE_MESSAGES.ERROR.FILE_NUMBER_EXISTS);
      }
    }

    const updated = await this.prisma.caseFile.update({
      where: { id },
      data: { fileNumber: dto.fileNumber },
      include: this.caseFileInclude,
    });

    await this.auditService.log({
      action: CASE_FILE_AUDIT_ACTIONS.UPDATED,
      userId,
      details: { caseFileId: id, changes: { fileNumber: { before: caseFile.fileNumber, after: dto.fileNumber } } },
    });

    return this.buildResponse(updated);
  }

  async close(id: string, userId: string) {
    const caseFile = await this.prisma.caseFile.findUnique({
      where: { id },
      include: {
        procedures: {
          where: {
            isActive: true,
            currentStatus: { in: ACTIVE_PROCEDURE_STATUSES as unknown as ProcedureStatus[] },
          },
          select: { id: true },
        },
      },
    });

    if (!caseFile || !caseFile.isActive) {
      throw new NotFoundException(CASE_FILE_MESSAGES.ERROR.NOT_FOUND);
    }
    if (caseFile.closedAt !== null) {
      throw new ConflictException(CASE_FILE_MESSAGES.ERROR.ALREADY_CLOSED);
    }
    if (caseFile.procedures.length > 0) {
      throw new ConflictException(CASE_FILE_MESSAGES.ERROR.HAS_ACTIVE_PROCEDURES);
    }

    const updated = await this.prisma.caseFile.update({
      where: { id },
      data: { closedAt: new Date() },
      include: this.caseFileInclude,
    });

    await this.auditService.log({
      action: CASE_FILE_AUDIT_ACTIONS.CLOSED,
      userId,
      details: { caseFileId: id },
    });

    return this.buildResponse(updated);
  }

  async reopen(id: string, userId: string) {
    const caseFile = await this.prisma.caseFile.findUnique({ where: { id } });

    if (!caseFile || !caseFile.isActive) {
      throw new NotFoundException(CASE_FILE_MESSAGES.ERROR.NOT_FOUND);
    }
    if (caseFile.closedAt === null) {
      throw new ConflictException(CASE_FILE_MESSAGES.ERROR.NOT_CLOSED);
    }

    const updated = await this.prisma.caseFile.update({
      where: { id },
      data: { closedAt: null },
      include: this.caseFileInclude,
    });

    await this.auditService.log({
      action: CASE_FILE_AUDIT_ACTIONS.REOPENED,
      userId,
      details: { caseFileId: id },
    });

    return this.buildResponse(updated);
  }

  async remove(id: string, userId: string) {
    const caseFile = await this.prisma.caseFile.findUnique({
      where: { id },
      include: {
        procedures: { where: { isActive: true }, select: { id: true } },
      },
    });

    if (!caseFile) {
      throw new NotFoundException(CASE_FILE_MESSAGES.ERROR.NOT_FOUND);
    }
    if (!caseFile.isActive) {
      throw new ConflictException(CASE_FILE_MESSAGES.ERROR.ALREADY_DELETED);
    }
    if (caseFile.procedures.length > 0) {
      throw new ConflictException(CASE_FILE_MESSAGES.ERROR.HAS_ANY_PROCEDURES);
    }

    await this.prisma.caseFile.update({
      where: { id },
      data: { isActive: false, deletedAt: new Date() },
    });

    await this.auditService.log({
      action: CASE_FILE_AUDIT_ACTIONS.DELETED,
      userId,
      details: { caseFileId: id },
    });

    return { message: CASE_FILE_MESSAGES.SUCCESS.DELETED, id };
  }
}
