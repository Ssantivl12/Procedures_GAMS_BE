import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { StorageService } from './storage/storage.service';
import { PrismaService } from '../db/prisma.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [ConfigModule, AuditModule],
  controllers: [DocumentsController],
  providers: [DocumentsService, StorageService, PrismaService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
