import {
  IsString, IsOptional, IsEnum, IsEmail,
  MinLength, MaxLength, Matches, IsArray,
  ArrayMaxSize, IsBoolean, IsNumber, IsIn, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CompanyCategory } from '@prisma/client';

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

export const DISTRICTS = [
  'DISTRITO 1', 'DISTRITO 2', 'DISTRITO 3', 'DISTRITO 4',
  'DISTRITO 5', 'DISTRITO 6', 'DISTRITO 7',
  'DISTRITO LAVA LAVA', 'DISTRITO CHIÑATA',
] as const;

export const GEO_ZONES  = ['Urbano', 'Rural'] as const;
export const UTM_ZONES  = ['19K', '20K']      as const;

export const EFFLUENT_DISPOSAL_OPTIONS = [
  'PTAR', 'PTAR+ALCANTARILLADO', 'ALCANTARILLADO COOPERATIVA',
  'POZO SEPTICO', 'OTRO',
] as const;

export const SOLID_WASTE_DISPOSAL_OPTIONS = [
  'GERES', 'TERCIARIZACIÓN', 'GERES+TERCIARIZACIÓN', 'OTRO',
] as const;

export const WATER_SUPPLY_OPTIONS = [
  'POZO DE AGUA', 'RED DE AGUA(COOPERATIVA)', 'CISTERNA',
  'EMAPAS', 'POZO+COOPERATIVA', 'OTROS',
] as const;

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
  @IsIn(DISTRICTS, { message: 'Distrito no válido' })
  district?: string;

  /** Zona geográfica: Urbano / Rural */
  @IsOptional()
  @IsIn(GEO_ZONES, { message: 'Zona geográfica debe ser Urbano o Rural' })
  geoZone?: string;

  /** Zona UTM: 19K / 20K */
  @IsOptional()
  @IsIn(UTM_ZONES, { message: 'Zona UTM debe ser 19K o 20K' })
  utmZone?: string;

  /** Coordenadas — ingreso manual */
  @IsOptional() @IsString() @MaxLength(100)
  coordinates?: string;

  /** Disposición Final de Efluentes Industriales */
  @IsOptional()
  @IsIn(EFFLUENT_DISPOSAL_OPTIONS, { message: 'Opción de disposición de efluentes no válida' })
  effluentDisposal?: string;

  /** Disposición de Residuos Sólidos */
  @IsOptional()
  @IsIn(SOLID_WASTE_DISPOSAL_OPTIONS, { message: 'Opción de disposición de residuos no válida' })
  solidWasteDisposal?: string;

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
  @IsIn(WATER_SUPPLY_OPTIONS, { message: 'Opción de abastecimiento de agua no válida' })
  waterSupply?: string;

  /** Potencia Instalada */
  @IsOptional() @IsNumber()
  installedPower?: number;
}