import { IsOptional, IsUUID, IsBoolean, IsInt, Min, Max, IsEnum } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ObservationCategory, ObservationPriority } from '@prisma/client';

export class QueryObservationsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @IsOptional()
  @IsUUID()
  cycleId?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  isResolved?: boolean;

  @IsOptional()
  @IsEnum(ObservationCategory)
  category?: ObservationCategory;

  @IsOptional()
  @IsEnum(ObservationPriority)
  priority?: ObservationPriority;
}
