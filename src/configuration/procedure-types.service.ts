import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';
import { UpdateProcedureTypeDto } from './dto/update-procedure-type.dto';
import { CONFIG_MESSAGES } from '../common/constants/configuration.constants';

@Injectable()
export class ProcedureTypesService {
  private readonly logger = new Logger(ProcedureTypesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.procedureType.findMany({
      orderBy: { id: 'asc' },
    });
  }

  async findOne(id: number) {
    const record = await this.prisma.procedureType.findUnique({ where: { id } });
    if (!record) {
      throw new NotFoundException(CONFIG_MESSAGES.PROCEDURE_TYPE.ERROR.NOT_FOUND);
    }
    return record;
  }

  async update(id: number, dto: UpdateProcedureTypeDto) {
    const record = await this.findOne(id);

    // Warn (but do not block) if modifying allowsObservations/allowsReentry
    // while there are active procedures of this type
    const hasActive =
      (dto.allowsObservations !== undefined || dto.allowsReentry !== undefined) &&
      (await this.prisma.procedure.count({
        where: { procedureTypeId: id, isActive: true },
      })) > 0;

    if (hasActive) {
      this.logger.warn(
        `ProcedureType ${record.code} has active procedures — modifying allowsObservations/allowsReentry may cause workflow inconsistencies`,
      );
    }

    const updated = await this.prisma.procedureType.update({
      where: { id },
      data: dto,
    });

    return {
      ...updated,
      ...(hasActive ? { warning: 'This type has active procedures. Changing workflow flags may cause inconsistencies.' } : {}),
    };
  }
}
