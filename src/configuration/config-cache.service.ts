import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ProcedureTypeCode } from '@prisma/client';
import { PrismaService } from '../db/prisma.service';

@Injectable()
export class ConfigCacheService implements OnModuleInit {
  private readonly logger = new Logger(ConfigCacheService.name);

  private deadlines: Map<string, number> = new Map();
  private nonWorkingDays: Set<string> = new Set(); // 'YYYY-MM-DD' strings

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await Promise.all([this.refreshDeadlines(), this.refreshNonWorkingDays()]);
    this.logger.log('Config cache initialized');
  }

  // ---------------------------------------------------------------------------
  // Deadline cache
  // ---------------------------------------------------------------------------
  async refreshDeadlines() {
    const records = await this.prisma.deadlineConfig.findMany({
      where: { isActive: true },
    });
    this.deadlines.clear();
    for (const r of records) {
      this.deadlines.set(this.deadlineKey(r.procedureType, r.cycleNumber), r.deadlineDays);
    }
    this.logger.debug(`Deadline cache refreshed: ${this.deadlines.size} entries`);
  }

  /**
   * Returns the configured deadline days for a given procedure type and actual
   * cycle number from ProcedureCycle. Maps to DeadlineConfig logic:
   *   - cycleNumber === 0 (first review) → lookup key 0
   *   - cycleNumber >= 1 (reentry) → lookup key 1
   */
  getDeadlineDays(procedureType: ProcedureTypeCode, actualCycleNumber: number): number | undefined {
    const configKey = actualCycleNumber === 0 ? 0 : 1;
    return this.deadlines.get(this.deadlineKey(procedureType, configKey));
  }

  // ---------------------------------------------------------------------------
  // Non-working days cache
  // ---------------------------------------------------------------------------
  async refreshNonWorkingDays() {
    const records = await this.prisma.nonWorkingDay.findMany({
      where: { isActive: true },
      select: { date: true },
    });
    this.nonWorkingDays.clear();
    for (const r of records) {
      this.nonWorkingDays.add(this.toDateString(r.date));
    }
    this.logger.debug(`NonWorkingDay cache refreshed: ${this.nonWorkingDays.size} entries`);
  }

  /**
   * Returns true if the given date is a non-working day (holiday) or weekend.
   * Uses UTC methods throughout to avoid timezone-shift bugs.
   */
  isNonWorkingDay(date: Date): boolean {
    const day = date.getUTCDay(); // 0 = Sunday, 6 = Saturday (UTC)
    if (day === 0 || day === 6) return true;
    return this.nonWorkingDays.has(this.toDateString(date));
  }

  /**
   * Counts working days between two dates (exclusive of start, inclusive of end).
   * Saturdays, Sundays, and registered non-working days are skipped.
   * Uses UTC methods to avoid timezone-shift bugs.
   */
  countWorkingDays(from: Date, to: Date): number {
    let count = 0;
    const current = new Date(from);
    current.setUTCDate(current.getUTCDate() + 1); // start counting from next day
    while (current <= to) {
      if (!this.isNonWorkingDay(current)) count++;
      current.setUTCDate(current.getUTCDate() + 1);
    }
    return count;
  }

  /**
   * Adds the given number of working days to a date, skipping non-working days.
   * Uses UTC methods to avoid timezone-shift bugs.
   */
  addWorkingDays(from: Date, days: number): Date {
    const result = new Date(from);
    let added = 0;
    while (added < days) {
      result.setUTCDate(result.getUTCDate() + 1);
      if (!this.isNonWorkingDay(result)) added++;
    }
    return result;
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  private deadlineKey(procedureType: ProcedureTypeCode, cycleNumber: number): string {
    return `${procedureType}:${cycleNumber}`;
  }

  private toDateString(date: Date): string {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}
