import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ProcedureStatus, ProcedureTypeCode, CompanyStatus } from '@prisma/client';
import { PrismaService } from '../db/prisma.service';
import { ConfigCacheService } from '../configuration/config-cache.service';

/**
 * Runs daily to persist daysElapsed and isOverdue on all active, non-terminal
 * procedures that have entered review at least once (reviewStartDate != null).
 *
 * These values are stored in the DB so that:
 *   - /alerts/overdue can filter with isOverdue: true (DB index-compatible)
 *   - /reports/* can order by daysElapsed without runtime calculation
 *   - Dashboard counts reflect real data
 */
@Injectable()
export class ProcedureSchedulerService {
  private readonly logger = new Logger(ProcedureSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: ConfigCacheService,
  ) {}

  // Runs every day at 00:05 AM — 5 min offset avoids midnight spikes
  @Cron('5 0 * * *')
  async updateOverdueAndElapsed() {
    this.logger.log('Daily procedure update started (daysElapsed + isOverdue)');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // All active, non-terminal procedures (clock starts at receptionDate for cycle 1)
    const procedures = await this.prisma.procedure.findMany({
      where: {
        isActive: true,
        currentStatus: {
          notIn: [ProcedureStatus.CERRADO, ProcedureStatus.ABANDONADO],
        },
      },
      select: {
        id: true,
        currentStatus: true,
        cycleCount: true,
        companyStatus: true,
        receptionDate: true,
        reviewStartDate: true,
        obsPickedDate: true,
        deadlineDate: true,
        procedureType: { select: { code: true } },
      },
    });

    let updated = 0;

    for (const p of procedures) {
      // Mirror the same logic as buildResponse: determine clockStartDate + deadlineDays
      // so that deadlineDate is recomputed from the current holiday cache (holidays added
      // after procedure creation are reflected in DB after the nightly run).
      let clockStartDate: Date | null = null;
      let deadlineDays: number | null = null;

      if (
        (p.currentStatus === ProcedureStatus.RECIBIDO ||
          p.currentStatus === ProcedureStatus.EN_REVISION) &&
        p.cycleCount <= 1
      ) {
        clockStartDate = p.receptionDate;
        // RAI en estado PROYECTO usa 10 días en primera revisión (cycleKey 1)
        const cycleKey =
          p.procedureType.code === ProcedureTypeCode.RAI &&
          p.companyStatus === CompanyStatus.PROYECTO
            ? 1
            : 0;
        deadlineDays = this.cache.getDeadlineDays(p.procedureType.code, cycleKey) ?? null;
      } else if (p.currentStatus === ProcedureStatus.EN_REVISION && p.reviewStartDate) {
        clockStartDate = p.reviewStartDate;
        deadlineDays = this.cache.getDeadlineDays(p.procedureType.code, 1) ?? null;
      } else if (
        p.currentStatus === ProcedureStatus.SUBSANACION_PENDIENTE_REINGRESO &&
        p.obsPickedDate
      ) {
        clockStartDate = p.obsPickedDate;
        deadlineDays = this.cache.getDeadlineDays(p.procedureType.code, 1) ?? null;
      }

      let daysElapsed = 0;
      let dynamicDeadline: Date | null = p.deadlineDate;

      if (clockStartDate !== null) {
        daysElapsed = this.cache.countWorkingDays(clockStartDate, today);
        if (deadlineDays !== null) {
          dynamicDeadline = this.cache.addWorkingDays(clockStartDate, deadlineDays);
        }
      }

      const isOverdue = dynamicDeadline != null && today > dynamicDeadline;

      await this.prisma.procedure.update({
        where: { id: p.id },
        data: { daysElapsed, isOverdue, deadlineDate: dynamicDeadline },
      });

      updated++;
    }

    this.logger.log(`Daily update complete: ${updated} procedures updated`);
  }
}
