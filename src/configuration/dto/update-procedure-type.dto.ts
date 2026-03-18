import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateProcedureTypeDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsBoolean()
  allowsObservations?: boolean;

  @IsOptional()
  @IsBoolean()
  allowsReentry?: boolean;
}
