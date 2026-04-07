import { Injectable } from '@nestjs/common';
import { ProcedureStatus, ProcedureTypeCode } from '@prisma/client';
import { PrismaService } from '../db/prisma.service';
import { ConfigCacheService } from '../configuration/config-cache.service';
import { QueryReportsDto } from './dto/query-reports.dto';

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: ConfigCacheService,
  ) {}

  // -------------------------------------------------------------------------
  // GET /reports/procedures
  // -------------------------------------------------------------------------
  async getProcedures(query: QueryReportsDto, userId?: string, isInspector?: boolean) {
    const {
      dateFrom,
      dateTo,
      procedureTypeCode,
      category,
      currentStatus,
      assignedInspectorId,
      municipality,
      page = 1,
      limit = 100,
    } = query;

    const inspectorFilter = isInspector ? userId : assignedInspectorId;

    const where: any = {
      isActive: true,
      ...(dateFrom ? { receptionDate: { gte: new Date(dateFrom) } } : {}),
      ...(dateTo
        ? { receptionDate: { ...(dateFrom ? { gte: new Date(dateFrom) } : {}), lte: new Date(dateTo) } }
        : {}),
      ...(procedureTypeCode ? { procedureType: { code: procedureTypeCode } } : {}),
      ...(category ? { caseFile: { company: { category } } } : {}),
      ...(currentStatus ? { currentStatus } : {}),
      ...(inspectorFilter ? { assignedInspectorUserId: inspectorFilter } : {}),
      ...(municipality ? { caseFile: { company: { municipality } } } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.procedure.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          procedureType: { select: { code: true } },
          assignedInspector: { select: { id: true, firstName: true, lastName: true } },
          caseFile: {
            select: {
              code: true,
              company: { select: { id: true, legalName: true, raiNumber: true, category: true } },
            },
          },
          observations: {
            where: { isResolved: false, isActive: true },
            select: { id: true },
          },
        },
        orderBy: { receptionDate: 'desc' },
      }),
      this.prisma.procedure.count({ where }),
    ]);

    const mapped = items.map((p) => ({
      procedureId: p.id,
      caseFileCode: p.caseFile.code,
      company: p.caseFile.company,
      procedureType: p.procedureType.code,
      procedureKind: p.procedureKind,
      currentStatus: p.currentStatus,
      cycleCount: p.cycleCount,
      receptionDate: p.receptionDate,
      reviewStartDate: p.reviewStartDate,
      deadlineDate: p.deadlineDate,
      daysElapsed: p.daysElapsed,
      isOverdue: p.isOverdue,
      approvalDate: p.approvalDate,
      expirationDate: p.expirationDate,
      approvalCertificate: p.approvalCertificate,
      routeSheetNumber: p.routeSheetNumber,
      openObservationsCount: p.observations.length,
      assignedInspector: p.assignedInspector
        ? {
            id: p.assignedInspector.id,
            fullName: `${p.assignedInspector.firstName} ${p.assignedInspector.lastName}`.trim(),
          }
        : null,
    }));

    if (query.format === 'csv') {
      return this.toCsv(mapped, [
        'procedureId', 'caseFileCode', 'company.legalName', 'company.raiNumber', 'company.category',
        'procedureType', 'procedureKind', 'currentStatus', 'cycleCount',
        'receptionDate', 'reviewStartDate', 'deadlineDate', 'daysElapsed', 'isOverdue',
        'approvalDate', 'expirationDate', 'approvalCertificate',
        'routeSheetNumber', 'openObservationsCount',
        'assignedInspector.fullName',
      ]);
    }

    return this.paginate(mapped, total, page, limit);
  }

  // -------------------------------------------------------------------------
  // GET /reports/companies
  // -------------------------------------------------------------------------
  async getCompanies(query: QueryReportsDto) {
    const { category, municipality, page = 1, limit = 100 } = query;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const ninetyDaysLater = new Date(today.getTime() + 90 * 86400000);

    const where: any = {
      isActive: true,
      ...(category ? { category } : {}),
      ...(municipality ? { municipality } : {}),
    };

    const [companies, total] = await Promise.all([
      this.prisma.company.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          caseFile: {
            select: {
              id: true,
              code: true,
              procedures: {
                where: { procedureType: { code: ProcedureTypeCode.RAI }, currentStatus: ProcedureStatus.CERRADO },
                orderBy: { approvalDate: 'desc' },
                take: 1,
                select: { expirationDate: true, approvalDate: true, currentStatus: true },
              },
            },
          },
        },
        orderBy: { legalName: 'asc' },
      }),
      this.prisma.company.count({ where }),
    ]);

    const mapped = companies.map((c) => {
      const latestRai = c.caseFile?.procedures[0] ?? null;
      let raiSemaforo: string | null = null;
      if (latestRai?.expirationDate) {
        const exp = latestRai.expirationDate;
        raiSemaforo = exp < today ? 'VENCIDO' : exp <= ninetyDaysLater ? 'POR_VENCER' : 'VIGENTE';
      }
      return {
        companyId: c.id,
        legalName: c.legalName,
        nit: c.nit,
        raiNumber: c.raiNumber,
        category: c.category,
        municipality: c.municipality,
        caseFileCode: c.caseFile?.code ?? null,
        raiExpirationDate: latestRai?.expirationDate ?? null,
        raiSemaforo,
      };
    });

    if (query.format === 'csv') {
      return this.toCsv(mapped, [
        'companyId', 'legalName', 'nit', 'raiNumber', 'category', 'municipality',
        'caseFileCode', 'raiExpirationDate', 'raiSemaforo',
      ]);
    }

    return this.paginate(mapped, total, page, limit);
  }

  // -------------------------------------------------------------------------
  // GET /reports/expired-rai
  // -------------------------------------------------------------------------
  async getExpiredRai(query: QueryReportsDto) {
    const { page = 1, limit = 100 } = query;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const ninetyDaysLater = new Date(today.getTime() + 90 * 86400000);

    const where: any = {
      isActive: true,
      currentStatus: ProcedureStatus.CERRADO,
      procedureType: { code: ProcedureTypeCode.RAI },
      expirationDate: { lte: ninetyDaysLater },
    };

    const [items, total] = await Promise.all([
      this.prisma.procedure.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          procedureType: { select: { code: true } },
          caseFile: {
            select: {
              code: true,
              company: { select: { id: true, legalName: true, raiNumber: true, category: true } },
            },
          },
        },
        orderBy: { expirationDate: 'asc' },
      }),
      this.prisma.procedure.count({ where }),
    ]);

    const mapped = items.map((p) => {
      const exp = (p as any).expirationDate;
      return {
        procedureId: p.id,
        caseFileCode: p.caseFile.code,
        company: p.caseFile.company,
        approvalDate: p.approvalDate,
        expirationDate: exp,
        semaforo: exp < today ? 'VENCIDO' : 'POR_VENCER',
      };
    });

    if (query.format === 'csv') {
      return this.toCsv(mapped, [
        'procedureId', 'caseFileCode', 'company.legalName', 'company.raiNumber', 'company.category',
        'approvalDate', 'expirationDate', 'semaforo',
      ]);
    }

    return this.paginate(mapped, total, page, limit);
  }

  // -------------------------------------------------------------------------
  // GET /reports/iaa-status
  // -------------------------------------------------------------------------
  async getIaaStatus(query: QueryReportsDto) {
    const { page = 1, limit = 100 } = query;
    const year = query.year ?? new Date().getFullYear();
    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year, 11, 31);

    const [companies, iaaProcs, total] = await Promise.all([
      this.prisma.company.findMany({
        where: { category: 'C3', isActive: true },
        select: { id: true, legalName: true, raiNumber: true },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { legalName: 'asc' },
      }),
      this.prisma.procedure.findMany({
        where: {
          procedureType: { code: ProcedureTypeCode.IAA },
          approvalDate: { gte: yearStart, lte: yearEnd },
        },
        select: {
          currentStatus: true,
          approvalDate: true,
          caseFile: { select: { companyId: true } },
        },
      }),
      this.prisma.company.count({ where: { category: 'C3', isActive: true } }),
    ]);

    const iaaByCompany = new Map<string, { status: string; approvalDate: Date | null }>();
    for (const p of iaaProcs) {
      const cid = p.caseFile.companyId;
      if (!iaaByCompany.has(cid) || p.currentStatus === ProcedureStatus.CERRADO) {
        iaaByCompany.set(cid, { status: p.currentStatus, approvalDate: p.approvalDate });
      }
    }

    const mapped = companies.map((c) => {
      const iaa = iaaByCompany.get(c.id);
      return {
        companyId: c.id,
        legalName: c.legalName,
        raiNumber: c.raiNumber,
        year,
        iaaStatus: iaa ? iaa.status : 'NO_PRESENTADO',
        iaaApprovalDate: iaa?.approvalDate ?? null,
      };
    });

    if (query.format === 'csv') {
      return this.toCsv(mapped, [
        'companyId', 'legalName', 'raiNumber', 'year', 'iaaStatus', 'iaaApprovalDate',
      ]);
    }

    return this.paginate(mapped, total, page, limit);
  }

  // -------------------------------------------------------------------------
  // GET /reports/activity
  // -------------------------------------------------------------------------
  async getActivity(query: QueryReportsDto) {
    const { dateFrom, dateTo, procedureTypeCode } = query;

    const from = dateFrom ? new Date(dateFrom) : new Date(new Date().getFullYear(), 0, 1);
    const to = dateTo ? new Date(dateTo) : new Date();

    const procedureTypeFilter = procedureTypeCode
      ? { procedureType: { code: procedureTypeCode } }
      : {};

    const [received, closed, abandoned, closedForAvg] = await Promise.all([
      this.prisma.procedure.count({
        where: { receptionDate: { gte: from, lte: to }, ...procedureTypeFilter },
      }),
      this.prisma.procedure.count({
        where: { currentStatus: ProcedureStatus.CERRADO, closedAt: { gte: from, lte: to }, ...procedureTypeFilter },
      }),
      this.prisma.procedure.count({
        where: { currentStatus: ProcedureStatus.ABANDONADO, closedAt: { gte: from, lte: to }, ...procedureTypeFilter },
      }),
      this.prisma.procedure.findMany({
        where: { currentStatus: ProcedureStatus.CERRADO, closedAt: { gte: from, lte: to }, ...procedureTypeFilter },
        select: { receptionDate: true, closedAt: true, cycleCount: true },
      }),
    ]);

    const avgDaysToClose =
      closedForAvg.length > 0
        ? Math.round(
            closedForAvg.reduce((s, p) => {
              return s + (p.closedAt ? this.cache.countWorkingDays(p.receptionDate, p.closedAt) : 0);
            }, 0) / closedForAvg.length,
          )
        : null;

    const avgCyclesPerProcedure =
      closedForAvg.length > 0
        ? +(closedForAvg.reduce((s, p) => s + p.cycleCount, 0) / closedForAvg.length).toFixed(2)
        : null;

    // byType breakdown
    const allTypes = Object.values(ProcedureTypeCode);
    const byTypeItems = await Promise.all(
      allTypes.map(async (code) => {
        const typeFilter = { procedureType: { code } };
        const [r, c, a] = await Promise.all([
          this.prisma.procedure.count({ where: { receptionDate: { gte: from, lte: to }, ...typeFilter } }),
          this.prisma.procedure.count({ where: { currentStatus: ProcedureStatus.CERRADO, closedAt: { gte: from, lte: to }, ...typeFilter } }),
          this.prisma.procedure.count({ where: { currentStatus: ProcedureStatus.ABANDONADO, closedAt: { gte: from, lte: to }, ...typeFilter } }),
        ]);
        return { type: code, received: r, closed: c, abandoned: a };
      }),
    );

    // byInspector breakdown
    const inspectors = await this.prisma.user.findMany({
      where: { isActive: true, roles: { some: { role: { name: 'INSPECTOR' as any } } } },
      select: { id: true, firstName: true, lastName: true },
    });

    const byInspector = await Promise.all(
      inspectors.map(async (u) => {
        const inspFilter = { assignedInspectorUserId: u.id };
        const [c, a] = await Promise.all([
          this.prisma.procedure.count({ where: { currentStatus: ProcedureStatus.CERRADO, closedAt: { gte: from, lte: to }, ...inspFilter } }),
          this.prisma.procedure.count({ where: { currentStatus: ProcedureStatus.ABANDONADO, closedAt: { gte: from, lte: to }, ...inspFilter } }),
        ]);
        return {
          inspector: { id: u.id, fullName: `${u.firstName} ${u.lastName}`.trim() },
          closed: c,
          abandoned: a,
        };
      }),
    );

    return {
      period: { from, to },
      received,
      closed,
      abandoned,
      avgDaysToClose,
      avgCyclesPerProcedure,
      byType: byTypeItems,
      byInspector,
    };
  }

  // -------------------------------------------------------------------------
  // CSV helpers (streaming approach — builds header + rows inline)
  // -------------------------------------------------------------------------
  toCsv(rows: any[], fields: string[]): { csv: string; filename: string } {
    const header = fields.join(',');
    const lines = rows.map((row) =>
      fields
        .map((f) => {
          const parts = f.split('.');
          let val: any = row;
          for (const part of parts) val = val?.[part];
          if (val == null) return '';
          const str = String(val);
          return str.includes(',') || str.includes('"') || str.includes('\n')
            ? `"${str.replace(/"/g, '""')}"`
            : str;
        })
        .join(','),
    );

    return {
      csv: [header, ...lines].join('\n'),
      filename: `reporte_${new Date().toISOString().slice(0, 10)}.csv`,
    };
  }

  private paginate<T>(data: T[], total: number, page: number, limit: number) {
    const totalPages = Math.ceil(total / limit);
    return {
      data,
      meta: { total, page, limit, totalPages, hasNextPage: page < totalPages, hasPreviousPage: page > 1 },
    };
  }
}
