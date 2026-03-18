import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { DocumentGroup } from '@prisma/client';

export class QueryDocumentsDto {
  @IsOptional()
  @IsUUID()
  cycleId?: string;

  @IsOptional()
  @IsEnum(DocumentGroup)
  docGroup?: DocumentGroup;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'false' || value === false) return false;
    if (value === 'true' || value === true) return true;
    return true; // default
  })
  @IsBoolean()
  isLatest?: boolean = true;

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
  limit?: number = 20;
}
