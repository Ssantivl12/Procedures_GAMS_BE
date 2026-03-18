import { IsDateString, IsOptional, IsString, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCycleDto {
  @IsDateString()
  reentryDate: string;

  // If provided, used as the start date for deadline calculation.
  // Defaults to reentryDate if not supplied.
  @IsOptional()
  @IsDateString()
  reviewStartDate?: string;

  @IsOptional()
  @IsString()
  note?: string;

  // When true: atomically transitions the procedure to EN_REVISION
  // in the same transaction as cycle creation.
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  autoTransition?: boolean;
}
