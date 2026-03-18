import { Transform } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { CompanyCategory, ProcedureStatus, ProcedureTypeCode } from '@prisma/client';

export class QueryReportsDto {
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsEnum(ProcedureTypeCode)
  procedureTypeCode?: ProcedureTypeCode;

  @IsOptional()
  @IsEnum(CompanyCategory)
  category?: CompanyCategory;

  @IsOptional()
  @IsEnum(ProcedureStatus)
  currentStatus?: ProcedureStatus;

  @IsOptional()
  @IsUUID()
  assignedInspectorId?: string;

  @IsOptional()
  @IsString()
  municipality?: string;

  @IsOptional()
  @IsString()
  format?: 'json' | 'csv' = 'json';

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number = 100;

  // for /reports/activity
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  year?: number;
}
