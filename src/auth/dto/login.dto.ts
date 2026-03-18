import { IsEmail, IsString, MinLength } from 'class-validator';
import { AUTH } from '../../common/constants/auth.constants';
import { UserRole } from '../../common/constants/role.constants';

export class LoginRequestDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(AUTH.PASSWORD.MIN_LENGTH)
  password: string;
}

export interface UserPayloadDto {
  sub: string;
  email: string;
  roles: UserRole[];
  firstName: string;
  lastName: string;
  isActive: boolean;
}

export class LoginResponseDto {
  accessToken: string;
  refreshToken: string;
  user: UserPayloadDto;
}