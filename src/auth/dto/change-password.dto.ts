import { IsString, MinLength } from 'class-validator';
import { AUTH } from '../../common/constants/auth.constants';

export class ChangePasswordRequestDto {
  @IsString()
  @MinLength(AUTH.PASSWORD.MIN_LENGTH)
  currentPassword: string;

  @IsString()
  @MinLength(AUTH.PASSWORD.MIN_LENGTH)
  newPassword: string;

  @IsString()
  @MinLength(AUTH.PASSWORD.MIN_LENGTH)
  confirmPassword: string;
}