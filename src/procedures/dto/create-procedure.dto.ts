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
import { ProcedureKind, CompanyStatus } from '@prisma/client';

export class CreateProcedureDto {
  @IsUUID()
  caseFileId: string;

  @IsInt()
  @IsPositive()
  procedureTypeId: number;

  @IsOptional()
  @IsEnum(ProcedureKind)
  procedureKind?: ProcedureKind;

  @IsDateString()
  receptionDate: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  routeSheetNumber?: string;

  @IsOptional()
  @IsEnum(CompanyStatus)
  companyStatus?: CompanyStatus;

  @IsOptional()
  @IsString()
  generalNotes?: string;
}
