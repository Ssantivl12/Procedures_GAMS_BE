import { IsOptional, IsString, MinLength, MaxLength, IsEnum } from 'class-validator';
import { ObservationCategory, ObservationPriority } from '@prisma/client';

export class UpdateObservationDto {
  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  summary?: string;

  @IsOptional()
  @IsString()
  details?: string;

  @IsOptional()
  @IsEnum(ObservationCategory)
  category?: ObservationCategory;

  @IsOptional()
  @IsEnum(ObservationPriority)
  priority?: ObservationPriority;
}
