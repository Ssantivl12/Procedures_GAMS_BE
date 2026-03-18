import { Module } from '@nestjs/common';
import { ProceduresController } from './procedures.controller';
import { CaseFileProceduresController } from './case-file-procedures.controller';
import { ProceduresService } from './procedures.service';
import { PrismaService } from '../db/prisma.service';
import { AuditService } from '../audit/audit.service';

@Module({
  controllers: [ProceduresController, CaseFileProceduresController],
  providers: [ProceduresService, PrismaService, AuditService],
  exports: [ProceduresService],
})
export class ProceduresModule {}
