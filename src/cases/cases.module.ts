import { Module } from '@nestjs/common';
import { CasesController } from './cases.controller';
import { CasesService } from './cases.service';
import { AuditService } from '../audit/audit.service';

@Module({
  controllers: [CasesController],
  providers: [CasesService, AuditService],
  exports: [CasesService],
})
export class CasesModule {}
