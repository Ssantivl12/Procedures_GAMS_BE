import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../db/prisma.service';

@Injectable()
export class WorkingDaysService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Load all non-working days (holidays) in a date range as a Set of 'YYYY-MM-DD' strings.
   * Used to pre-fetch once when processing multiple procedures.
   */
  async loadHolidaysInRange(from: Date, to: Date): Promise<Set<string>> {
    const records = await this.prisma.nonWorkingDay.findMany({
      where: { isActive: true, date: { gte: from, lte: to } },
      select: { date: true },
    });
    return new Set(records.map((r) => this.toDateStr(r.date)));
  }

  /**
   * Add N working days (Mon–Fri, excluding holidays) to startDate.
   * Queries DB for holidays unless a pre-loaded Set is provided.
   */
  async addWorkingDays(startDate: Date, days: number, holidays?: Set<string>): Promise<Date> {
    if (!holidays) {
      // Estimate upper bound: days * 2 covers weekends + a few holidays
      const upperBound = new Date(startDate);
      upperBound.setDate(upperBound.getDate() + days * 2 + 10);
      holidays = await this.loadHolidaysInRange(startDate, upperBound);
    }

    let count = 0;
    const current = new Date(startDate);
    while (count < days) {
      current.setDate(current.getDate() + 1);
      if (this.isWorkingDay(current, holidays)) {
        count++;
      }
    }
    return new Date(current);
  }

  /**
   * Count working days (Mon–Fri, excluding holidays) between startDate and endDate (exclusive of startDate).
   * Queries DB for holidays unless a pre-loaded Set is provided.
   */
  async countWorkingDays(startDate: Date, endDate: Date, holidays?: Set<string>): Promise<number> {
    if (endDate <= startDate) return 0;
    if (!holidays) {
      holidays = await this.loadHolidaysInRange(startDate, endDate);
    }

    let count = 0;
    const current = new Date(startDate);
    while (current < endDate) {
      current.setDate(current.getDate() + 1);
      if (current <= endDate && this.isWorkingDay(current, holidays)) {
        count++;
      }
    }
    return count;
  }

  private isWorkingDay(date: Date, holidays: Set<string>): boolean {
    const day = date.getDay(); // 0 = Sunday, 6 = Saturday
    if (day === 0 || day === 6) return false;
    return !holidays.has(this.toDateStr(date));
  }

  private toDateStr(date: Date): string {
    // Always format as YYYY-MM-DD in local date (avoid timezone shifts)
    const d = new Date(date);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}
