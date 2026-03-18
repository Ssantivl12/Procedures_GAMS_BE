import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { ProcedureTypeCode } from '@prisma/client';

export class CreateDeadlineDto {
  @IsEnum(ProcedureTypeCode)
  procedureType: ProcedureTypeCode;

  @IsInt()
  @Min(0)
  cycleNumber: number;

  @IsInt()
  @Min(1)
  deadlineDays: number;

  @IsOptional()
  @IsString()
  description?: string;
}
