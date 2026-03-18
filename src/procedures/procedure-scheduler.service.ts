import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ProcedureStatus } from '@prisma/client';
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

    // Only active, non-terminal procedures that have started review
    const procedures = await this.prisma.procedure.findMany({
      where: {
        isActive: true,
        currentStatus: {
          notIn: [ProcedureStatus.CERRADO, ProcedureStatus.ABANDONADO],
        },
        reviewStartDate: { not: null },
      },
      select: { id: true, reviewStartDate: true, deadlineDate: true },
    });

    let updated = 0;

    for (const p of procedures) {
      const daysElapsed = this.cache.countWorkingDays(p.reviewStartDate!, today);
      const isOverdue = p.deadlineDate != null && today > p.deadlineDate;

      await this.prisma.procedure.update({
        where: { id: p.id },
        data: { daysElapsed, isOverdue },
      });

      updated++;
    }

    this.logger.log(`Daily update complete: ${updated} procedures updated`);
  }
}
