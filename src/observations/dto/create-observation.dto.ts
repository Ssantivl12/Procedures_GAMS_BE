import { IsUUID, IsString, MinLength, MaxLength, IsOptional, IsEnum } from 'class-validator';
import { ObservationCategory, ObservationPriority } from '@prisma/client';

export class CreateObservationDto {
  // Optional: if not provided, the service auto-resolves to the current active cycle.
  @IsOptional()
  @IsUUID()
  cycleId?: string;

  @IsString()
  @MinLength(5)
  @MaxLength(500)
  summary: string;

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
