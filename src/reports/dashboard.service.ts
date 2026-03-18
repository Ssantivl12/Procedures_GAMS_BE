import { Injectable } from '@nestjs/common';
import { ProcedureStatus, ProcedureTypeCode } from '@prisma/client';
import { PrismaService } from '../db/prisma.service';
import { ConfigCacheService } from '../configuration/config-cache.service';
import { UserRole } from '../common/constants/role.constants';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: ConfigCacheService,
  ) {}

  async getDashboard(userId: string, roles: string[]) {
    if (roles.includes(UserRole.INSPECTOR)) {
      return this.getInspectorDashboard(userId);
    }
    if (roles.includes(UserRole.SECRETARIA)) {
      return this.getSecretariaDashboard();
    }
    // ENCARGADO or SUPERADMIN
    return this.getAdminDashboard();
  }

  // -------------------------------------------------------------------------
  // SECRETARIA view
  // -------------------------------------------------------------------------
  private async getSecretariaDashboard() {
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 7);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const [pendingPickup, pendingReentry, recentlyReceived, overdueCount, abandonedThisMonth] =
      await Promise.all([
        // Procedures waiting for contributor to pick up observations
        this.prisma.procedure.findMany({
          where: { currentStatus: ProcedureStatus.OBSERVADO_PENDIENTE_RECOJO, isActive: true },
          select: {
            id: true,
            currentStatus: true,
            procedureType: { select: { code: true } },
            caseFile: {
              select: {
                code: true,
                company: { select: { id: true, legalName: true } },
              },
            },
            audits: {
              where: { toStatus: ProcedureStatus.OBSERVADO_PENDIENTE_RECOJO },
              orderBy: { changedAt: 'desc' },
              take: 1,
              select: { changedAt: true },
            },
          },
        }),

        // Procedures waiting for contributor reentry
        this.prisma.procedure.findMany({
          where: {
            currentStatus: ProcedureStatus.SUBSANACION_PENDIENTE_REINGRESO,
            isActive: true,
          },
          select: {
            id: true,
            currentStatus: true,
            deadlineDate: true,
            isOverdue: true,
            procedureType: { select: { code: true } },
            caseFile: {
              select: {
                code: true,
                company: { select: { id: true, legalName: true } },
              },
            },
          },
        }),

        // Last 10 received in past 7 days
        this.prisma.procedure.findMany({
          where: { createdAt: { gte: sevenDaysAgo }, isActive: true },
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            currentStatus: true,
            receptionDate: true,
            procedureType: { select: { code: true } },
            caseFile: {
              select: {
                code: true,
                company: { select: { id: true, legalName: true } },
              },
            },
          },
        }),

        // Count of overdue in active statuses
        this.prisma.procedure.count({
          where: {
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
          },
        }),

        // Abandoned this month
        this.prisma.procedure.findMany({
          where: {
            currentStatus: ProcedureStatus.ABANDONADO,
            closedAt: { gte: monthStart, lte: monthEnd },
          },
          select: {
            id: true,
            closedAt: true,
            procedureType: { select: { code: true } },
            caseFile: {
              select: {
                code: true,
                company: { select: { id: true, legalName: true } },
              },
            },
          },
        }),
      ]);

    return {
      role: UserRole.SECRETARIA,
      pendingPickup: pendingPickup.map((p) => ({
        id: p.id,
        caseFileCode: p.caseFile.code,
        company: p.caseFile.company,
        procedureType: p.procedureType.code,
        obsIssuedAt: p.audits[0]?.changedAt ?? null,
      })),
      pendingReentry: pendingReentry.map((p) => ({
        id: p.id,
        caseFileCode: p.caseFile.code,
        company: p.caseFile.company,
        procedureType: p.procedureType.code,
        deadlineDate: p.deadlineDate,
        daysRemaining: p.deadlineDate ? this.calcDaysRemaining(p.deadlineDate) : null,
        isOverdue: p.isOverdue,
      })),
      recentlyReceived: recentlyReceived.map((p) => ({
        id: p.id,
        caseFileCode: p.caseFile.code,
        company: p.caseFile.company,
        procedureType: p.procedureType.code,
        currentStatus: p.currentStatus,
        receptionDate: p.receptionDate,
      })),
      overdueCount,
      abandonedThisMonth: abandonedThisMonth.map((p) => ({
        id: p.id,
        caseFileCode: p.caseFile.code,
        company: p.caseFile.company,
        procedureType: p.procedureType.code,
        closedAt: p.closedAt,
      })),
    };
  }

  // -------------------------------------------------------------------------
  // INSPECTOR view
  // -------------------------------------------------------------------------
  private async getInspectorDashboard(userId: string) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const procedureSelect = {
      id: true,
      currentStatus: true,
      deadlineDate: true,
      isOverdue: true,
      daysElapsed: true,
      procedureType: { select: { code: true } },
      caseFile: {
        select: {
          code: true,
          company: { select: { id: true, legalName: true } },
        },
      },
    } as const;

    const [myQueue, unassigned, closedThisMonth, pendingObsCount] = await Promise.all([
      this.prisma.procedure.findMany({
        where: { assignedInspectorUserId: userId, currentStatus: ProcedureStatus.EN_REVISION, isActive: true },
        orderBy: { deadlineDate: 'asc' },
        select: procedureSelect,
      }),
      this.prisma.procedure.findMany({
        where: { currentStatus: ProcedureStatus.RECIBIDO, assignedInspectorUserId: null, isActive: true },
        orderBy: { receptionDate: 'asc' },
        select: procedureSelect,
      }),
      this.prisma.procedure.findMany({
        where: {
          assignedInspectorUserId: userId,
          currentStatus: ProcedureStatus.CERRADO,
          closedAt: { gte: monthStart, lte: monthEnd },
        },
        select: procedureSelect,
      }),
      this.prisma.observation.count({
        where: {
          isResolved: false,
          isActive: true,
          procedure: { assignedInspectorUserId: userId, isActive: true },
        },
      }),
    ]);

    const mapProcedure = (p: any) => ({
      id: p.id,
      caseFileCode: p.caseFile.code,
      company: p.caseFile.company,
      procedureType: p.procedureType.code,
      currentStatus: p.currentStatus,
      deadlineDate: p.deadlineDate,
      daysRemaining: p.deadlineDate ? this.calcDaysRemaining(p.deadlineDate) : null,
      daysElapsed: p.daysElapsed,
      isOverdue: p.isOverdue,
    });

    return {
      role: UserRole.INSPECTOR,
      myQueue: myQueue.map(mapProcedure),
      myOverdue: myQueue.filter((p) => p.isOverdue).map(mapProcedure),
      unassigned: unassigned.map(mapProcedure),
      closedThisMonth: closedThisMonth.map(mapProcedure),
      pendingObsCount,
    };
  }

  // -------------------------------------------------------------------------
  // ENCARGADO / SUPERADMIN view
  // -------------------------------------------------------------------------
  private async getAdminDashboard() {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    const iaaDeadline = new Date(now.getFullYear(), 4, 31); // May 31

    const [
      statusGroups,
      typeGroups,
      overdueList,
      raiExpiring,
      inspectorWorkloadRaw,
      activityReceived,
      activityClosed,
      activityAbandoned,
    ] = await Promise.all([
      // Status counts
      this.prisma.procedure.groupBy({
        by: ['currentStatus'],
        _count: { id: true },
        where: { isActive: true },
      }),

      // Type counts (active only)
      this.prisma.procedure.groupBy({
        by: ['procedureTypeId'],
        _count: { id: true },
        where: { isActive: true },
      }),

      // Overdue list
      this.prisma.procedure.findMany({
        where: { isOverdue: true, isActive: true },
        select: {
          id: true,
          currentStatus: true,
          deadlineDate: true,
          daysElapsed: true,
          procedureType: { select: { code: true } },
          assignedInspector: { select: { id: true, firstName: true, lastName: true } },
          caseFile: {
            select: {
              code: true,
              company: { select: { id: true, legalName: true } },
            },
          },
        },
        orderBy: { daysElapsed: 'desc' },
      }),

      // RAI procedures with expirationDate near or passed
      this.prisma.procedure.findMany({
        where: {
          procedureType: { code: ProcedureTypeCode.RAI },
          currentStatus: ProcedureStatus.CERRADO,
          expirationDate: { not: null },
        },
        select: {
          id: true,
          expirationDate: true,
          approvalDate: true,
          caseFile: {
            select: {
              code: true,
              company: { select: { id: true, legalName: true, raiNumber: true } },
            },
          },
        },
      }),

      // Inspector workload
      this.prisma.user.findMany({
        where: { isActive: true, roles: { some: { role: { name: 'INSPECTOR' as any } } } },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          assignedProcedures: {
            where: { isActive: true, currentStatus: { not: ProcedureStatus.CERRADO } },
            select: { id: true, isOverdue: true },
          },
        },
      }),

      // Activity this month — received
      this.prisma.procedure.count({
        where: { createdAt: { gte: monthStart, lte: monthEnd } },
      }),

      // Activity this month — closed
      this.prisma.procedure.count({
        where: { currentStatus: ProcedureStatus.CERRADO, closedAt: { gte: monthStart, lte: monthEnd } },
      }),

      // Activity this month — abandoned
      this.prisma.procedure.count({
        where: { currentStatus: ProcedureStatus.ABANDONADO, closedAt: { gte: monthStart, lte: monthEnd } },
      }),
    ]);

    // Resolve typeSummary with actual codes
    const procedureTypeMap = await this.prisma.procedureType.findMany({
      select: { id: true, code: true },
    });
    const typeCodeById = Object.fromEntries(procedureTypeMap.map((t) => [t.id, t.code]));

    const statusSummary: Record<string, number> = {};
    for (const g of statusGroups) statusSummary[g.currentStatus] = g._count.id;

    const typeSummary: Record<string, number> = {};
    for (const g of typeGroups) {
      const code = typeCodeById[g.procedureTypeId];
      if (code) typeSummary[code] = g._count.id;
    }

    // RAI expiration semaphore
    const today = new Date();
    const ninetyDaysLater = new Date(today);
    ninetyDaysLater.setDate(today.getDate() + 90);

    const raiExpirationAlerts = raiExpiring.map((p) => {
      const exp = p.expirationDate!;
      const semaforo = exp < today ? 'VENCIDO' : exp <= ninetyDaysLater ? 'POR_VENCER' : 'VIGENTE';
      return {
        procedureId: p.id,
        caseFileCode: p.caseFile.code,
        company: p.caseFile.company,
        expirationDate: exp,
        semaforo,
      };
    }).filter((p) => p.semaforo !== 'VIGENTE');

    // IAA delinquent — only after May 31
    let iaaDelinquent: any[] = [];
    if (now >= iaaDeadline) {
      const currentYear = now.getFullYear();
      const yearStart = new Date(currentYear, 0, 1);
      const yearEnd = new Date(currentYear, 11, 31);

      // Companies Cat 3 with a closed IAA this year
      const withIaa = await this.prisma.procedure.findMany({
        where: {
          procedureType: { code: ProcedureTypeCode.IAA },
          currentStatus: ProcedureStatus.CERRADO,
          approvalDate: { gte: yearStart, lte: yearEnd },
        },
        select: { caseFile: { select: { companyId: true } } },
      });
      const companyIdsWithIaa = new Set(withIaa.map((p) => p.caseFile.companyId));

      const cat3Companies = await this.prisma.company.findMany({
        where: { category: 'C3', isActive: true },
        select: { id: true, legalName: true, raiNumber: true },
      });

      iaaDelinquent = cat3Companies.filter((c) => !companyIdsWithIaa.has(c.id));
    }

    // Inspector workload
    const inspectorWorkload = inspectorWorkloadRaw.map((u) => ({
      inspector: { id: u.id, fullName: `${u.firstName} ${u.lastName}`.trim() },
      activeCount: u.assignedProcedures.length,
      overdueCount: u.assignedProcedures.filter((p) => p.isOverdue).length,
    }));

    // Avg days to close this month
    const closedThisMonthProcs = await this.prisma.procedure.findMany({
      where: { currentStatus: ProcedureStatus.CERRADO, closedAt: { gte: monthStart, lte: monthEnd } },
      select: { receptionDate: true, closedAt: true },
    });
    const avgDaysToClose =
      closedThisMonthProcs.length > 0
        ? Math.round(
            closedThisMonthProcs.reduce((sum, p) => {
              const days = p.closedAt
                ? this.cache.countWorkingDays(p.receptionDate, p.closedAt)
                : 0;
              return sum + days;
            }, 0) / closedThisMonthProcs.length,
          )
        : null;

    return {
      role: 'ADMIN',
      statusSummary,
      typeSummary,
      overdueList: overdueList.map((p) => ({
        procedureId: p.id,
        caseFileCode: p.caseFile.code,
        company: p.caseFile.company,
        procedureType: p.procedureType.code,
        currentStatus: p.currentStatus,
        deadlineDate: p.deadlineDate,
        daysOverdue: p.daysElapsed,
        assignedInspector: p.assignedInspector
          ? {
              id: p.assignedInspector.id,
              fullName: `${p.assignedInspector.firstName} ${p.assignedInspector.lastName}`.trim(),
            }
          : null,
      })),
      raiExpirationAlerts,
      iaaDelinquent,
      inspectorWorkload,
      activityThisMonth: {
        received: activityReceived,
        closed: activityClosed,
        abandoned: activityAbandoned,
        avgDaysToClose,
      },
    };
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------
  private calcDaysRemaining(deadlineDate: Date): number {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dl = new Date(deadlineDate);
    dl.setHours(0, 0, 0, 0);
    return this.cache.countWorkingDays(today, dl);
  }
}
