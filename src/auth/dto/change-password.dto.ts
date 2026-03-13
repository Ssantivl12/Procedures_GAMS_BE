import { IsString, MaxLength, MinLength } from 'class-validator';
import { AUTH } from '../../common/constants/auth.constants';

export class ChangePasswordRequestDto {
  @IsString()
  @MinLength(AUTH.PASSWORD.MIN_LENGTH)
  @MaxLength(AUTH.PASSWORD.MAX_LENGTH)
  currentPassword: string;

  @IsString()
  @MinLength(AUTH.PASSWORD.MIN_LENGTH)
  @MaxLength(AUTH.PASSWORD.MAX_LENGTH)
  newPassword: string;

  @IsString()
  @MinLength(AUTH.PASSWORD.MIN_LENGTH)
  @MaxLength(AUTH.PASSWORD.MAX_LENGTH)
  confirmPassword: string;
}