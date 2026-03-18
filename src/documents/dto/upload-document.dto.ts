import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { DocumentGroup } from '@prisma/client';

export class UploadDocumentDto {
  @IsEnum(DocumentGroup)
  docGroup: DocumentGroup;

  @IsOptional()
  @IsUUID()
  cycleId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
