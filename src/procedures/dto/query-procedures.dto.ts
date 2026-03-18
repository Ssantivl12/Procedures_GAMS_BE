import {
  IsOptional,
  IsInt,
  Min,
  Max,
  IsEnum,
  IsUUID,
  IsBoolean,
  IsString,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ProcedureStatus, ProcedureKind, ProcedureTypeCode } from '@prisma/client';

export class QueryProceduresDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 10;

  @IsOptional()
  @IsUUID()
  caseFileId?: string;

  @IsOptional()
  @IsEnum(ProcedureTypeCode)
  procedureTypeCode?: ProcedureTypeCode;

  @IsOptional()
  @IsEnum(ProcedureKind)
  procedureKind?: ProcedureKind;

  @IsOptional()
  @IsEnum(ProcedureStatus)
  status?: ProcedureStatus;

  @IsOptional()
  @IsUUID()
  assignedInspectorId?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isOverdue?: boolean;

  @IsOptional()
  @IsString()
  @MinLength(2)
  search?: string;
}
