import {
  IsEnum,
  IsOptional,
  IsString,
  IsNotEmpty,
  IsDateString,
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

  // Required when toStatus = EN_REVISION
  @ValidateIf((o) => o.toStatus === ProcedureStatus.EN_REVISION)
  @IsNotEmpty()
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
