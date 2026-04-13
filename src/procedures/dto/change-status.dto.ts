import {
  IsEnum,
  IsOptional,
  IsString,
  IsNotEmpty,
  IsDateString,
  IsInt,
  Min,
  ValidateIf,
} from 'class-validator';
import { ProcedureStatus } from '@prisma/client';

export class ChangeStatusDto {
  @IsEnum(ProcedureStatus)
  toStatus: ProcedureStatus;

  @IsOptional()
  @IsString()
  note?: string;

  // Required when toStatus = ABANDONADO
  @ValidateIf((o) => o.toStatus === ProcedureStatus.ABANDONADO)
  @IsNotEmpty()
  @IsString()
  abandonReason?: string;

  // Required when toStatus = SUBSANACION_PENDIENTE_REINGRESO
  @ValidateIf((o) => o.toStatus === ProcedureStatus.SUBSANACION_PENDIENTE_REINGRESO)
  @IsNotEmpty()
  @IsDateString()
  obsPickedDate?: string;

  // Required when toStatus = SUBSANACION_PENDIENTE_REINGRESO
  // Días hábiles que tiene la empresa para subsanar (ingresado por el personal al registrar el recojo)
  @ValidateIf((o) => o.toStatus === ProcedureStatus.SUBSANACION_PENDIENTE_REINGRESO)
  @IsNotEmpty()
  @IsInt()
  @Min(1)
  subsanacionDays?: number;

  // Optional metadata when toStatus = EN_REVISION (no longer drives deadline calculation)
  @IsOptional()
  @IsDateString()
  reviewStartDate?: string;

  // Required when toStatus = CERRADO
  @ValidateIf((o) => o.toStatus === ProcedureStatus.CERRADO)
  @IsNotEmpty()
  @IsDateString()
  approvalDate?: string;

  // Required when toStatus = CERRADO
  @ValidateIf((o) => o.toStatus === ProcedureStatus.CERRADO)
  @IsNotEmpty()
  @IsString()
  approvalCertificate?: string;

  // Required when toStatus = CERRADO and type is RAI (validated in service)
  @IsOptional()
  @IsDateString()
  expirationDate?: string;
}
