import { IsOptional, IsEnum, IsInt, Min, Max, IsString, MinLength, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { CompanyCategory } from '@prisma/client';

export class QueryCaseFilesDto {
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
  @IsString()
  @MinLength(2)
  search?: string;

  @IsOptional()
  @IsIn(['open', 'closed'])
  status?: 'open' | 'closed';

  @IsOptional()
  @IsEnum(CompanyCategory)
  category?: CompanyCategory;

  @IsOptional()
  @IsIn(['true', 'false', true, false])
  @Type(() => Boolean)
  isActive?: boolean = true;
}
