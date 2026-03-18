import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateCaseFileDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  fileNumber?: string;
}
