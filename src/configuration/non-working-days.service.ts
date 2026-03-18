import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';
import { ConfigCacheService } from './config-cache.service';
import { CreateNonWorkingDayDto } from './dto/create-non-working-day.dto';
import { BulkNonWorkingDaysDto } from './dto/bulk-non-working-days.dto';
import { QueryNonWorkingDaysDto } from './dto/query-non-working-days.dto';
import { UpdateNonWorkingDayDto } from './dto/update-non-working-day.dto';
import { CONFIG_MESSAGES } from '../common/constants/configuration.constants';

@Injectable()
export class NonWorkingDaysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: ConfigCacheService,
  ) {}

  async findAll(query: QueryNonWorkingDaysDto) {
    const { year, type, isActive = true } = query;

    const where: any = { isActive };

    if (type) where.type = type;

    if (year) {
      const start = new Date(`${year}-01-01`);
      const end = new Date(`${year}-12-31`);
      where.date = { gte: start, lte: end };
    }

    return this.prisma.nonWorkingDay.findMany({
      where,
      orderBy: { date: 'asc' },
    });
  }

  async create(dto: CreateNonWorkingDayDto, createdBy?: string) {
    const date = new Date(dto.date);

    const existing = await this.prisma.nonWorkingDay.findUnique({
      where: { date },
    });
    if (existing) {
      throw new ConflictException(CONFIG_MESSAGES.NON_WORKING_DAY.ERROR.DUPLICATE);
    }

    const record = await this.prisma.nonWorkingDay.create({
      data: {
        date,
        description: dto.description,
        type: dto.type,
        createdBy: createdBy ?? null,
      },
    });
    await this.cache.refreshNonWorkingDays();
    return record;
  }

  async bulkCreate(dto: BulkNonWorkingDaysDto, createdBy?: string) {
    const inserted: any[] = [];
    const skipped: string[] = [];

    for (const item of dto.days) {
      const date = new Date(item.date);
      const existing = await this.prisma.nonWorkingDay.findUnique({ where: { date } });
      if (existing) {
        skipped.push(item.date);
        continue;
      }
      const record = await this.prisma.nonWorkingDay.create({
        data: {
          date,
          description: item.description,
          type: item.type,
          createdBy: createdBy ?? null,
        },
      });
      inserted.push(record);
    }

    if (inserted.length > 0) {
      await this.cache.refreshNonWorkingDays();
    }

    return {
      inserted: inserted.length,
      skipped: skipped.length,
      skippedDates: skipped,
    };
  }

  async update(id: number, dto: UpdateNonWorkingDayDto) {
    await this.findActive(id);
    const record = await this.prisma.nonWorkingDay.update({
      where: { id },
      data: dto,
    });
    await this.cache.refreshNonWorkingDays();
    return record;
  }

  async deactivate(id: number) {
    const record = await this.prisma.nonWorkingDay.findUnique({ where: { id } });
    if (!record) {
      throw new NotFoundException(CONFIG_MESSAGES.NON_WORKING_DAY.ERROR.NOT_FOUND);
    }
    if (!record.isActive) {
      throw new ConflictException(CONFIG_MESSAGES.NON_WORKING_DAY.ERROR.INACTIVE);
    }
    await this.prisma.nonWorkingDay.update({
      where: { id },
      data: { isActive: false },
    });
    await this.cache.refreshNonWorkingDays();
    return { message: CONFIG_MESSAGES.NON_WORKING_DAY.SUCCESS.DEACTIVATED };
  }

  private async findActive(id: number) {
    const record = await this.prisma.nonWorkingDay.findUnique({ where: { id } });
    if (!record || !record.isActive) {
      throw new NotFoundException(CONFIG_MESSAGES.NON_WORKING_DAY.ERROR.NOT_FOUND);
    }
    return record;
  }
}
