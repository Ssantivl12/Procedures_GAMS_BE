import { IsString } from 'class-validator';

export class RefreshTokenRequestDto {
  @IsString()
  refreshToken: string;
}

export class RefreshTokenResponseDto {
  accessToken: string;
  refreshToken: string;
}