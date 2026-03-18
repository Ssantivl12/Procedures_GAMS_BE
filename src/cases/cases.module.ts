import { Module } from '@nestjs/common';
import { CasesController } from './cases.controller';
import { CasesService } from './cases.service';
import { PrismaService } from '../db/prisma.service';
import { AuditService } from '../audit/audit.service';

@Module({
  controllers: [CasesController],
  providers: [CasesService, PrismaService, AuditService],
  exports: [CasesService],
})
export class CasesModule {}
