import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ProcedureStatus, ProcedureTypeCode, CompanyStatus } from '@prisma/client';
import { PrismaService } from '../db/prisma.service';
import { ConfigCacheService } from '../configuration/config-cache.service';
import {
  RAI_PROYECTO_FIXED_DAYS,
  MAI_PMA_PROYECTO_FIRST_DAYS,
  MAI_PMA_PROYECTO_REINGRESO_DAYS,
} from '../common/constants/procedure.constants';

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

    // All active, non-terminal procedures
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
        deadlineDate: true,
        subsanacionDeadlineDate: true,
        procedureType: { select: { code: true } },
      },
    });

    let updated = 0;

    for (const p of procedures) {
      // ── Plazo del personal (deadlineDate) ─────────────────────────────────
      // Mirrors buildResponse logic: recompute from holiday cache so that holidays
      // added after procedure creation are automatically reflected in DB.
      let clockStartDate: Date | null = null;
      let deadlineDays: number | null = null;

      if (
        (p.currentStatus === ProcedureStatus.RECIBIDO ||
          p.currentStatus === ProcedureStatus.EN_REVISION) &&
        p.cycleCount <= 1
      ) {
        clockStartDate = p.receptionDate;
        // Reglas de dominio fijas para primer ciclo
        if (p.procedureType.code === ProcedureTypeCode.RAI && p.companyStatus === CompanyStatus.PROYECTO) {
          deadlineDays = RAI_PROYECTO_FIXED_DAYS;
        } else if (p.procedureType.code === ProcedureTypeCode.MAI_PMA && p.companyStatus === CompanyStatus.PROYECTO) {
          deadlineDays = MAI_PMA_PROYECTO_FIRST_DAYS;
        } else {
          deadlineDays = this.cache.getDeadlineDays(p.procedureType.code, 0) ?? null;
        }
      } else if (p.currentStatus === ProcedureStatus.EN_REVISION && p.reviewStartDate) {
        clockStartDate = p.reviewStartDate;
        // Reglas de dominio fijas para reingresos
        if (p.procedureType.code === ProcedureTypeCode.RAI && p.companyStatus === CompanyStatus.PROYECTO) {
          deadlineDays = RAI_PROYECTO_FIXED_DAYS;
        } else if (p.procedureType.code === ProcedureTypeCode.MAI_PMA && p.companyStatus === CompanyStatus.PROYECTO) {
          deadlineDays = MAI_PMA_PROYECTO_REINGRESO_DAYS;
        } else {
          deadlineDays = this.cache.getDeadlineDays(p.procedureType.code, 1) ?? null;
        }
      }
      // SUBSANACION: el reloj del personal está pausado; no se recalcula deadlineDate.

      let daysElapsed = 0;
      let dynamicDeadline: Date | null = p.deadlineDate;

      if (clockStartDate !== null) {
        daysElapsed = this.cache.countWorkingDays(clockStartDate, today);
        if (deadlineDays !== null) {
          dynamicDeadline = this.cache.addWorkingDays(clockStartDate, deadlineDays);
        }
      }

      // ── isOverdue del personal ─────────────────────────────────────────────
      // Para SUBSANACION el isOverdue del personal no aplica (reloj pausado).
      // Se usa subsanacionDeadlineDate para detectar subsanaciones vencidas en alertas.
      const hasActiveClock =
        p.currentStatus === ProcedureStatus.RECIBIDO ||
        p.currentStatus === ProcedureStatus.EN_REVISION;

      const isOverdue = hasActiveClock && dynamicDeadline != null && today > dynamicDeadline;

      await this.prisma.procedure.update({
        where: { id: p.id },
        data: { daysElapsed, isOverdue, deadlineDate: dynamicDeadline },
      });

      updated++;
    }

    this.logger.log(`Daily update complete: ${updated} procedures updated`);
  }
}
