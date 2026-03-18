import { IsOptional, IsString } from 'class-validator';

export class ResolveObservationDto {
  @IsOptional()
  @IsString()
  resolutionNote?: string;
}
