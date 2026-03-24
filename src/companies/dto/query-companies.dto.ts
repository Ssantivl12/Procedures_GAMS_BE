import { IsOptional, IsEnum, IsInt, Min, Max, IsString, MinLength, IsBoolean, IsIn } from 'class-validator';
import { Type, Transform  } from 'class-transformer';
import { CompanyCategory } from '@prisma/client';

export class QueryCompaniesDto {
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
  @IsString()
  @MinLength(2)
  search?: string;

  @IsOptional()
  @IsEnum(CompanyCategory)
  category?: CompanyCategory;

  @IsOptional()
  @IsString()
  municipality?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true || value === '1') return true;
    if (value === 'false' || value === false || value === '0') return false;
    return undefined;
  })
  @IsBoolean()
  hasRaiNumber?: boolean;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true || value === '1') return true;
    if (value === 'false' || value === false || value === '0') return false;
    return true; 
  })
  @IsBoolean()
  isActive?: boolean = true;

  @IsOptional()
  @IsIn(['legalName', 'createdAt', 'raiNumber'])
  sortBy?: string = 'legalName';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'asc';
}