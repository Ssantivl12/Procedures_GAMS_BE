import {
  IsString, IsOptional, IsEnum, IsEmail,
  MinLength, MaxLength, Matches, IsArray,
  ArrayMaxSize, IsBoolean, IsNumber, IsIn, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CompanyCategory, District, GeoZone, UtmZone, EffluentDisposal, SolidWasteDisposal, WaterSupply } from '@prisma/client';

export class RawMaterialDto {
  @IsString() @MaxLength(255)
  name: string;

  @IsString() @MaxLength(100)
  quantity: string;
}

export class FinalProductDto {
  @IsString() @MaxLength(255)
  name: string;

  @IsString() @MaxLength(100)
  quantity: string;

  @IsString() @MaxLength(50)
  unit: string;
}

export class LegalRepresentativeDto {
  @IsString() @MaxLength(255)
  name: string;

  @IsOptional() @IsString() @MaxLength(20)
  ci?: string;

  @IsOptional() @IsString() @MaxLength(500)
  phone?: string;
}



export class CreateCompanyDto {

  /** Unidad Industrial */
  @IsString() @MinLength(3) @MaxLength(255)
  legalName: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{7,13}$/, { message: 'NIT debe tener entre 7 y 13 dígitos' })
  nit?: string;

  @IsEnum(CompanyCategory)
  category: CompanyCategory;

  @IsOptional() @IsString() @MaxLength(255)
  address?: string;

  /** Contacto U.I */
  @IsOptional() @IsString() @MaxLength(500)
  phone?: string;

  @IsOptional() @IsEmail()
  email?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LegalRepresentativeDto)
  legalRepresentatives?: LegalRepresentativeDto[];

  @IsOptional() @IsString() @MaxLength(255)
  legalRepName?: string;

  @IsOptional() @IsString() @MaxLength(20)
  legalRepCi?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @Matches(/^\d{5}$/, { each: true, message: 'Cada código CAEB debe tener 5 dígitos' })
  caebCodes?: string[];

  @IsOptional() @IsString() @MaxLength(500)
  economicActivity?: string;

  @IsOptional() @IsString() @MaxLength(100)
  municipality?: string;

  @IsOptional() @IsString() @MaxLength(1000)
  observations?: string;

  /** Clase — descripción de actividad */
  @IsOptional() @IsString() @MaxLength(500)
  businessClass?: string;

  /** Distrito */
  @IsOptional()
  @IsEnum(District, { message: 'Distrito no válido' })
  district?: District;

  /** Zona geográfica: Urbano / Rural */
  @IsOptional()
  @IsEnum(GeoZone, { message: 'Zona geográfica no válida' })
  geoZone?: GeoZone;

  /** Zona UTM: 19K / 20K */
  @IsOptional()
  @IsEnum(UtmZone, { message: 'Zona UTM debe ser 19K o 20K' })
  utmZone?: UtmZone;

  /** Coordenadas — ingreso manual */
  @IsOptional() @IsString() @MaxLength(100)
  coordinates?: string;

  /** Disposición Final de Efluentes Industriales */
  @IsOptional()
  @IsEnum(EffluentDisposal, { message: 'Opción de disposición de efluentes no válida' })
  effluentDisposal?: EffluentDisposal;

  /** Disposición de Residuos Sólidos */
  @IsOptional()
  @IsEnum(SolidWasteDisposal, { message: 'Opción de disposición de residuos no válida' })
  solidWasteDisposal?: SolidWasteDisposal;

  /** Uso de sustancias peligrosas */
  @IsOptional() @IsBoolean()
  useHazardousSubstances?: boolean;

  /** Descripción de sustancias peligrosas (solo si useHazardousSubstances = true) */
  @IsOptional() @IsString() @MaxLength(1000)
  hazardousSubstancesDescription?: string;

  /** Uso de mercurio */
  @IsOptional() @IsBoolean()
  usesMercury?: boolean;

  /** Materias Primas */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RawMaterialDto)
  rawMaterials?: RawMaterialDto[];

  /** Productos Finales */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FinalProductDto)
  finalProducts?: FinalProductDto[];

  /** Superficie Utilizada */
  @IsOptional() @IsNumber()
  usedArea?: number;

  /** Unidad de superficie */
  @IsOptional() @IsString() @MaxLength(20)
  areaUnit?: string;

  /** Abastecimiento de Agua */
  @IsOptional()
  @IsEnum(WaterSupply, { message: 'Opción de abastecimiento de agua no válida' })
  waterSupply?: WaterSupply;

  /** Potencia Instalada */
  @IsOptional() @IsNumber()
  installedPower?: number;
}