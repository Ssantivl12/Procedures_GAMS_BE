import { IsOptional, IsEnum, IsInt, Min, Max, IsString, MinLength, IsBoolean, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
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
  @Type(() => Boolean)
  @IsBoolean()
  hasRaiNumber?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean = true;

  @IsOptional()
  @IsIn(['legalName', 'createdAt', 'raiNumber'])
  sortBy?: string = 'legalName';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'asc';
}