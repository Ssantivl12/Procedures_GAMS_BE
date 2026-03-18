import { Module } from '@nestjs/common';
import { ObservationsController } from './observations.controller';
import { CycleObservationsController } from './cycle-observations.controller';
import { ObservationsService } from './observations.service';
import { PrismaService } from '../db/prisma.service';
import { AuditService } from '../audit/audit.service';

@Module({
  controllers: [ObservationsController, CycleObservationsController],
  providers: [ObservationsService, PrismaService, AuditService],
  exports: [ObservationsService],
})
export class ObservationsModule {}
