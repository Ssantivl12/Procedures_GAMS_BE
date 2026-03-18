import { IsOptional, IsString } from 'class-validator';

export class CloseCycleDto {
  @IsOptional()
  @IsString()
  note?: string;
}
