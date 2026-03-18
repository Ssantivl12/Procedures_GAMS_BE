import { Injectable } from '@nestjs/common';
import { ProcedureStatus, ProcedureTypeCode } from '@prisma/client';
import { PrismaService } from '../db/prisma.service';
import { ConfigCacheService } from '../configuration/config-cache.service';
import { QueryAlertsDto } from './dto/query-alerts.dto';

// ---------------------------------------------------------------------------
// Shared Prisma include for alert items
// ---------------------------------------------------------------------------
const ALERT_INCLUDE = {
  procedureType: { select: { code: true } },
  assignedInspector: { select: { id: true, firstName: true, lastName: true } },
  caseFile: {
    select: {
      code: true,
      company: { select: { id: true, legalName: true, raiNumber: true } },
    },
  },
} as const;

@Injectable()
export class AlertsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: ConfigCacheService,
  ) {}

  // -------------------------------------------------------------------------
  // GET /alerts/overdue
  // -------------------------------------------------------------------------
  async getOverdue(query: QueryAlertsDto, userId?: string, isInspector?: boolean) {
    const { page = 1, limit = 20, assignedInspectorId, procedureTypeCode } = query;
    const inspectorFilter = isInspector ? userId : assignedInspectorId;

    const where: any = {
      isOverdue: true,
      isActive: true,
      currentStatus: {
        in: [
          ProcedureStatus.RECIBIDO,
          ProcedureStatus.EN_REVISION,
          ProcedureStatus.OBSERVADO_PENDIENTE_RECOJO,
          ProcedureStatus.SUBSANACION_PENDIENTE_REINGRESO,
        ],
      },
      ...(inspectorFilter ? { assignedInspectorUserId: inspectorFilter } : {}),
      ...(procedureTypeCode ? { procedureType: { code: procedureTypeCode } } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.procedure.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: ALERT_INCLUDE,
        orderBy: { daysElapsed: 'desc' },
      }),
      this.prisma.procedure.count({ where }),
    ]);

    return this.paginate(items.map((p) => this.mapAlertItem(p, 'OVERDUE')), total, page, limit);
  }

  // -------------------------------------------------------------------------
  // GET /alerts/due-soon
  // -------------------------------------------------------------------------
  async getDueSoon(query: QueryAlertsDto, userId?: string, isInspector?: boolean) {
    const { page = 1, limit = 20, days = 3, assignedInspectorId, procedureTypeCode } = query;
    const inspectorFilter = isInspector ? userId : assignedInspectorId;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const cutoff = this.cache.addWorkingDays(today, days);

    const where: any = {
      isActive: true,
      isOverdue: false,
      deadlineDate: { gte: today, lte: cutoff },
      currentStatus: { in: [ProcedureStatus.EN_REVISION, ProcedureStatus.RECIBIDO] },
      ...(inspectorFilter ? { assignedInspectorUserId: inspectorFilter } : {}),
      ...(procedureTypeCode ? { procedureType: { code: procedureTypeCode } } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.procedure.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: ALERT_INCLUDE,
        orderBy: { deadlineDate: 'asc' },
      }),
      this.prisma.procedure.count({ where }),
    ]);

    return this.paginate(items.map((p) => this.mapAlertItem(p, 'DUE_SOON')), total, page, limit);
  }

  // -------------------------------------------------------------------------
  // GET /alerts/pending-pickup
  // -------------------------------------------------------------------------
  async getPendingPickup(query: QueryAlertsDto, userId?: string, isInspector?: boolean) {
    const { page = 1, limit = 20, days = 5, assignedInspectorId, procedureTypeCode } = query;
    const inspectorFilter = isInspector ? userId : assignedInspectorId;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const where: any = {
      isActive: true,
      currentStatus: ProcedureStatus.OBSERVADO_PENDIENTE_RECOJO,
      ...(inspectorFilter ? { assignedInspectorUserId: inspectorFilter } : {}),
      ...(procedureTypeCode ? { procedureType: { code: procedureTypeCode } } : {}),
      audits: {
        some: {
          toStatus: ProcedureStatus.OBSERVADO_PENDIENTE_RECOJO,
          changedAt: { lte: cutoffDate },
        },
      },
    };

    const [items, total] = await Promise.all([
      this.prisma.procedure.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: ALERT_INCLUDE,
        orderBy: { deadlineDate: 'asc' },
      }),
      this.prisma.procedure.count({ where }),
    ]);

    return this.paginate(items.map((p) => this.mapAlertItem(p, 'PENDING_PICKUP')), total, page, limit);
  }

  // -------------------------------------------------------------------------
  // GET /alerts/rai-expiration
  // -------------------------------------------------------------------------
  async getRaiExpiration(query: QueryAlertsDto) {
    const { page = 1, limit = 20, withinDays = 90 } = query;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const cutoff = new Date(today);
    cutoff.setDate(today.getDate() + withinDays);

    const where: any = {
      isActive: true,
      currentStatus: ProcedureStatus.CERRADO,
      procedureType: { code: ProcedureTypeCode.RAI },
      expirationDate: { lte: cutoff },
    };

    const [items, total] = await Promise.all([
      this.prisma.procedure.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: ALERT_INCLUDE,
        orderBy: { expirationDate: 'asc' },
      }),
      this.prisma.procedure.count({ where }),
    ]);

    return this.paginate(
      items.map((p) => ({
        ...this.mapAlertItem(p, 'RAI_EXPIRATION'),
        expirationDate: (p as any).expirationDate,
        semaforo: (p as any).expirationDate < today ? 'VENCIDO' : 'POR_VENCER',
      })),
      total,
      page,
      limit,
    );
  }

  // -------------------------------------------------------------------------
  // GET /alerts/iaa-missing
  // -------------------------------------------------------------------------
  async getIaaMissing(query: QueryAlertsDto) {
    const { page = 1, limit = 20 } = query;
    const now = new Date();
    const iaaDeadline = new Date(now.getFullYear(), 4, 31); // May 31

    if (now < iaaDeadline) {
      return this.paginate([], 0, page, limit);
    }

    const currentYear = now.getFullYear();
    const yearStart = new Date(currentYear, 0, 1);
    const yearEnd = new Date(currentYear, 11, 31);

    const withIaa = await this.prisma.procedure.findMany({
      where: {
        procedureType: { code: ProcedureTypeCode.IAA },
        currentStatus: ProcedureStatus.CERRADO,
        approvalDate: { gte: yearStart, lte: yearEnd },
      },
      select: { caseFile: { select: { companyId: true } } },
    });
    const companyIdsWithIaa = new Set(withIaa.map((p) => p.caseFile.companyId));

    const all = await this.prisma.company.findMany({
      where: { category: 'C3', isActive: true },
      select: { id: true, legalName: true, raiNumber: true, category: true },
    });

    const missing = all.filter((c) => !companyIdsWithIaa.has(c.id));
    const sliced = missing.slice((page - 1) * limit, page * limit);

    return this.paginate(
      sliced.map((c) => ({
        alertType: 'IAA_MISSING',
        company: { id: c.id, legalName: c.legalName, raiNumber: c.raiNumber },
        category: c.category,
        year: currentYear,
      })),
      missing.length,
      page,
      limit,
    );
  }

  // -------------------------------------------------------------------------
  // GET /alerts/summary
  // -------------------------------------------------------------------------
  async getSummary(userId?: string, isInspector?: boolean) {
    const inspectorFilter = isInspector ? userId : undefined;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const threeDaysLater = this.cache.addWorkingDays(today, 3);
    const iaaDeadline = new Date(today.getFullYear(), 4, 31);
    const now = new Date();

    const activeStatuses = [
      ProcedureStatus.RECIBIDO,
      ProcedureStatus.EN_REVISION,
      ProcedureStatus.OBSERVADO_PENDIENTE_RECOJO,
      ProcedureStatus.SUBSANACION_PENDIENTE_REINGRESO,
    ];

    const baseWhere = inspectorFilter ? { assignedInspectorUserId: inspectorFilter } : {};

    const [overdue, dueSoon, pendingPickup, raiExpiring] = await Promise.all([
      this.prisma.procedure.count({
        where: { isOverdue: true, isActive: true, currentStatus: { in: activeStatuses }, ...baseWhere },
      }),
      this.prisma.procedure.count({
        where: {
          isActive: true,
          isOverdue: false,
          deadlineDate: { gte: today, lte: threeDaysLater },
          currentStatus: { in: [ProcedureStatus.EN_REVISION, ProcedureStatus.RECIBIDO] },
          ...baseWhere,
        },
      }),
      this.prisma.procedure.count({
        where: { isActive: true, currentStatus: ProcedureStatus.OBSERVADO_PENDIENTE_RECOJO, ...baseWhere },
      }),
      this.prisma.procedure.count({
        where: {
          isActive: true,
          currentStatus: ProcedureStatus.CERRADO,
          procedureType: { code: ProcedureTypeCode.RAI },
          expirationDate: { lte: new Date(today.getTime() + 90 * 86400000) },
        },
      }),
    ]);

    let iaaMissing = 0;
    if (now >= iaaDeadline) {
      const currentYear = now.getFullYear();
      const withIaa = await this.prisma.procedure.findMany({
        where: {
          procedureType: { code: ProcedureTypeCode.IAA },
          currentStatus: ProcedureStatus.CERRADO,
          approvalDate: {
            gte: new Date(currentYear, 0, 1),
            lte: new Date(currentYear, 11, 31),
          },
        },
        select: { caseFile: { select: { companyId: true } } },
      });
      const idsWithIaa = new Set(withIaa.map((p) => p.caseFile.companyId));
      const cat3Count = await this.prisma.company.count({ where: { category: 'C3', isActive: true } });
      iaaMissing = Math.max(0, cat3Count - idsWithIaa.size);
    }

    return {
      overdue,
      dueSoon,
      pendingPickup,
      raiExpiring,
      iaaMissing,
      total: overdue + dueSoon + pendingPickup + raiExpiring + iaaMissing,
      asOf: new Date(),
    };
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------
  private mapAlertItem(p: any, alertType: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isOverdue = p.isOverdue ?? false;
    const deadlineDate = p.deadlineDate;

    let daysOverdue: number | null = null;
    let daysRemaining: number | null = null;
    if (deadlineDate) {
      if (isOverdue) {
        daysOverdue = this.cache.countWorkingDays(new Date(deadlineDate), today);
      } else {
        daysRemaining = this.cache.countWorkingDays(today, new Date(deadlineDate));
      }
    }

    return {
      alertType,
      procedureId: p.id,
      caseFileCode: p.caseFile.code,
      company: p.caseFile.company,
      procedureType: p.procedureType.code,
      currentStatus: p.currentStatus,
      deadlineDate,
      daysOverdue,
      daysRemaining,
      assignedInspector: p.assignedInspector
        ? {
            id: p.assignedInspector.id,
            fullName: `${p.assignedInspector.firstName} ${p.assignedInspector.lastName}`.trim(),
          }
        : null,
    };
  }

  private paginate<T>(data: T[], total: number, page: number, limit: number) {
    const totalPages = Math.ceil(total / limit);
    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }
}
