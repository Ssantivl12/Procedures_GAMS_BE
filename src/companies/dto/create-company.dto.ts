import {
  IsString,
  IsOptional,
  IsEnum,
  IsEmail,
  MinLength,
  MaxLength,
  Matches,
  IsArray,
  ArrayMaxSize,
} from 'class-validator';
import { CompanyCategory } from '@prisma/client';

export class CreateCompanyDto {
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  legalName: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{7,13}$/, { message: 'NIT debe tener entre 7 y 13 dígitos' })
  nit?: string;

  @IsEnum(CompanyCategory)
  category: CompanyCategory;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+591\d{7,8}$/, { message: 'Teléfono debe tener formato +591XXXXXXXX' })
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  legalRepName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  legalRepCi?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @Matches(/^\d{5}$/, { each: true, message: 'Cada código CAEB debe tener 5 dígitos' })
  caebCodes?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  economicActivity?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  municipality?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  observations?: string;
}