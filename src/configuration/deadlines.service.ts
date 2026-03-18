import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';
import { ConfigCacheService } from './config-cache.service';
import { CreateDeadlineDto } from './dto/create-deadline.dto';
import { UpdateDeadlineDto } from './dto/update-deadline.dto';
import { CONFIG_MESSAGES } from '../common/constants/configuration.constants';

@Injectable()
export class DeadlinesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: ConfigCacheService,
  ) {}

  async findAll() {
    return this.prisma.deadlineConfig.findMany({
      orderBy: [{ procedureType: 'asc' }, { cycleNumber: 'asc' }],
    });
  }

  async findOne(id: number) {
    const record = await this.prisma.deadlineConfig.findUnique({ where: { id } });
    if (!record || !record.isActive) {
      throw new NotFoundException(CONFIG_MESSAGES.DEADLINE.ERROR.NOT_FOUND);
    }
    return record;
  }

  async create(dto: CreateDeadlineDto) {
    const existing = await this.prisma.deadlineConfig.findUnique({
      where: {
        procedureType_cycleNumber: {
          procedureType: dto.procedureType,
          cycleNumber: dto.cycleNumber,
        },
      },
    });
    if (existing) {
      throw new ConflictException(CONFIG_MESSAGES.DEADLINE.ERROR.DUPLICATE);
    }

    const record = await this.prisma.deadlineConfig.create({ data: dto });
    await this.cache.refreshDeadlines();
    return record;
  }

  async update(id: number, dto: UpdateDeadlineDto) {
    await this.findOne(id);
    const record = await this.prisma.deadlineConfig.update({
      where: { id },
      data: dto,
    });
    await this.cache.refreshDeadlines();
    return record;
  }

  async deactivate(id: number) {
    const record = await this.prisma.deadlineConfig.findUnique({ where: { id } });
    if (!record) {
      throw new NotFoundException(CONFIG_MESSAGES.DEADLINE.ERROR.NOT_FOUND);
    }
    if (!record.isActive) {
      throw new ConflictException(CONFIG_MESSAGES.DEADLINE.ERROR.INACTIVE);
    }
    await this.prisma.deadlineConfig.update({
      where: { id },
      data: { isActive: false },
    });
    await this.cache.refreshDeadlines();
    return { message: CONFIG_MESSAGES.DEADLINE.SUCCESS.DEACTIVATED };
  }
}
