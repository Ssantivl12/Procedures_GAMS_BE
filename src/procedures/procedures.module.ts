import { Module } from '@nestjs/common';
import { ProceduresController } from './procedures.controller';
import { CaseFileProceduresController } from './case-file-procedures.controller';
import { ProceduresService } from './procedures.service';
import { ProcedureSchedulerService } from './procedure-scheduler.service';
import { AuditService } from '../audit/audit.service';
import { SnapshotModule } from '../snapshot/snapshot.module';
import { ConfigurationModule } from '../configuration/configuration.module';

@Module({
  imports: [ConfigurationModule, SnapshotModule],
  controllers: [ProceduresController, CaseFileProceduresController],
  providers: [ProceduresService, ProcedureSchedulerService, AuditService],
  exports: [ProceduresService],
})
export class ProceduresModule {}
