import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
  Ip,
  Headers,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import {
  LoginRequestDto,
  LoginResponseDto,
  RefreshTokenRequestDto,
  ChangePasswordRequestDto,
} from './dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { Roles } from './roles.decorator';
import { UserRole } from '../common/constants/role.constants';
import { AUTH } from '../common/constants';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ login: { limit: AUTH.RATE_LIMIT.LOGIN.limit, ttl: AUTH.RATE_LIMIT.LOGIN.ttl } })
  async login(
    @Body() dto: LoginRequestDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ): Promise<LoginResponseDto> {
    return this.authService.login(dto, ip, userAgent);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body() dto: RefreshTokenRequestDto,
  ): Promise<LoginResponseDto> {
    return this.authService.refreshToken(dto);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: any, @Body('refreshToken') refreshToken?: string) {
    const user = req.user;
    await this.authService.logout(user.sub, refreshToken);
  }

  @Post('change-password')
  @UseGuards(ThrottlerGuard, JwtAuthGuard, RolesGuard)
  @Throttle({ password: { limit: AUTH.RATE_LIMIT.PASSWORD.limit, ttl: AUTH.RATE_LIMIT.PASSWORD.ttl } })
  @Roles(UserRole.SUPERADMIN, UserRole.ENCARGADO, UserRole.SECRETARIA, UserRole.INSPECTOR)
  @HttpCode(HttpStatus.NO_CONTENT)
  async changePassword(
    @Req() req: any,
    @Body() dto: ChangePasswordRequestDto,
  ) {
    const user = req.user;
    await this.authService.changePassword(user.sub, dto);
  }

  // No hay endpoint público de registro
}