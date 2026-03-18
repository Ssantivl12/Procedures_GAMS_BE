import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Min } from 'class-validator';
import { ProcedureTypeCode } from '@prisma/client';

export class QueryAlertsDto {
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @IsOptional()
  @IsUUID()
  assignedInspectorId?: string;

  @IsOptional()
  @IsEnum(ProcedureTypeCode)
  procedureTypeCode?: ProcedureTypeCode;

  // specific to /alerts/due-soon
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  days?: number = 3;

  // specific to /alerts/rai-expiration
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  withinDays?: number = 90;
}
