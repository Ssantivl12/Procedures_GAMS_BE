import { IsInt, IsOptional, IsString, Min, IsEnum } from 'class-validator';
import { ProcedureTypeCode } from '@prisma/client';

export class UpdateDeadlineDto {
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
