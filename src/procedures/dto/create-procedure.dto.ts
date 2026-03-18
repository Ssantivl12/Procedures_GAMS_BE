import {
  IsUUID,
  IsInt,
  IsPositive,
  IsEnum,
  IsDateString,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ProcedureKind } from '@prisma/client';

export class CreateProcedureDto {
  @IsUUID()
  caseFileId: string;

  @IsInt()
  @IsPositive()
  procedureTypeId: number;

  @IsEnum(ProcedureKind)
  procedureKind: ProcedureKind;

  @IsDateString()
  receptionDate: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  routeSheetNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  internalFileNumber?: string;

  @IsOptional()
  @IsString()
  generalNotes?: string;
}
