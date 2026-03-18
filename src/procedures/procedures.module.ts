import { Module } from '@nestjs/common';
import { ProceduresController } from './procedures.controller';
import { CaseFileProceduresController } from './case-file-procedures.controller';
import { ProceduresService } from './procedures.service';
import { ProcedureSchedulerService } from './procedure-scheduler.service';
import { PrismaService } from '../db/prisma.service';
import { AuditService } from '../audit/audit.service';
import { WorkingDaysService } from '../common/services/working-days.service';
import { ConfigurationModule } from '../configuration/configuration.module';

@Module({
  imports: [ConfigurationModule],
  controllers: [ProceduresController, CaseFileProceduresController],
  providers: [ProceduresService, ProcedureSchedulerService, PrismaService, AuditService, WorkingDaysService],
  exports: [ProceduresService, WorkingDaysService],
})
export class ProceduresModule {}
