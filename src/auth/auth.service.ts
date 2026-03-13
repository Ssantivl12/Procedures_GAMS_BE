import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../db/prisma.service';
import { UsersService } from '../users/users.service';
import { AuditService } from '../audit/audit.service';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

import {
  LoginRequestDto,
  LoginResponseDto,
  RefreshTokenRequestDto,
  ChangePasswordRequestDto,
  UserPayloadDto,
} from './dto';
import { AUTH, UserRole } from '../common/constants';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) { }

  // -----------------------------------------------------------------
  // Validación interna de credenciales
  // -----------------------------------------------------------------
  private async validateUser(email: string, password: string): Promise<UserPayloadDto | null> {
    const user = await this.usersService.findByEmail(email);
    if (!user || !user.isActive) return null;

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) return null;

    const roles = user.roles
      .filter((ur) => ur.role.isActive)
      .map((ur) => ur.role.name as UserRole);

    return {
      sub: user.id.toString(), // JWT payload requiere string
      email: user.email,
      roles,
      fullName: user.fullName,
      isActive: user.isActive,
    };
  }

  // -----------------------------------------------------------------
  // Login – genera access & refresh token, almacena refresh token
  // -----------------------------------------------------------------
  async login(
    dto: LoginRequestDto,
    ip: string,
    userAgent: string,
  ): Promise<LoginResponseDto> {
    const user = await this.validateUser(dto.email, dto.password);
    if (!user) {
      await this.auditService.log({
        action: AUTH.AUDIT_ACTIONS.LOGIN_FAILED,
        details: { email: dto.email, ip, userAgent },
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { ...user };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get('JWT_SECRET'),
        expiresIn: this.configService.get('JWT_EXPIRES_IN', '1h'),
      }),
      this.jwtService.signAsync(
        { sub: user.sub, jti: uuidv4() },
        {
          secret: this.configService.get('JWT_SECRET'),
          expiresIn: this.configService.get('REFRESH_TOKEN_EXPIRES_IN', '7d'),
        },
      ),
    ]);

    await this.prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.sub, // String
        expiresAt: new Date(Date.now() + AUTH.REFRESH_TOKEN.EXPIRES_MS),
        ip,
        userAgent,
      },
    });

    await this.auditService.log({
      action: AUTH.AUDIT_ACTIONS.LOGIN_SUCCESS,
      userId: user.sub,
      details: { ip, userAgent },
    });

    return {
      accessToken,
      refreshToken,
      user,
    };
  }

  // -----------------------------------------------------------------
  // Refresh token – rotación obligatoria (revoca anterior, crea nuevo)
  // -----------------------------------------------------------------
  async refreshToken(dto: RefreshTokenRequestDto): Promise<LoginResponseDto> {
    const refreshToken = await this.prisma.refreshToken.findUnique({
      where: { token: dto.refreshToken },
      include: {
        user: {
          include: {
            roles: { include: { role: true }, where: { revokedAt: null } },
          },
        },
      },
    });

    if (
      !refreshToken ||
      refreshToken.revoked ||
      refreshToken.expiresAt < new Date()
    ) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = refreshToken.user;
    const roles = user.roles
      .filter((ur) => ur.role.isActive)
      .map((ur) => ur.role.name as UserRole);

    const payload: UserPayloadDto = {
      sub: user.id, // String
      email: user.email,
      roles,
      fullName: user.fullName,
      isActive: user.isActive,
    };

    const [newAccessToken, newRefreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get('JWT_SECRET'),
        expiresIn: this.configService.get('JWT_EXPIRES_IN', '1h'),
      }),
      this.jwtService.signAsync(
        { sub: user.id, jti: uuidv4() },
        {
          secret: this.configService.get('JWT_SECRET'),
          expiresIn: this.configService.get('REFRESH_TOKEN_EXPIRES_IN', '7d'),
        },
      ),
    ]);

    // Rotación: revocar token actual y crear uno nuevo
    await this.prisma.$transaction([
      this.prisma.refreshToken.update({
        where: { id: refreshToken.id },
        data: { revoked: true, revokedAt: new Date() },
      }),
      this.prisma.refreshToken.create({
        data: {
          token: newRefreshToken,
          userId: user.id,
          expiresAt: new Date(Date.now() + AUTH.REFRESH_TOKEN.EXPIRES_MS),
          ip: refreshToken.ip,
          userAgent: refreshToken.userAgent,
        },
      }),
    ]);

    await this.auditService.log({
      action: AUTH.AUDIT_ACTIONS.REFRESH_TOKEN,
      userId: user.id,
      details: {},
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      user: payload,
    };
  }

  // -----------------------------------------------------------------
  // Logout – revoca el refresh token específico (si se provee)
  // -----------------------------------------------------------------
  async logout(userId: string, refreshToken?: string) {
    if (refreshToken) {
      await this.prisma.refreshToken.updateMany({
        where: { token: refreshToken, userId },
        data: { revoked: true, revokedAt: new Date() },
      });
    }

    await this.auditService.log({
      action: AUTH.AUDIT_ACTIONS.LOGOUT,
      userId,
      details: {},
    });
  }

  // -----------------------------------------------------------------
  // Cambio de contraseña – valida actual, hashea nueva, revoca todos los tokens
  // -----------------------------------------------------------------
  async changePassword(userId: string, dto: ChangePasswordRequestDto) {
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    const user = await this.usersService.findById(userId);
    const isMatch = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const newHash = await bcrypt.hash(dto.newPassword, AUTH.PASSWORD.BCRYPT_ROUNDS);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });

    // Revocar todos los refresh tokens activos del usuario
    await this.prisma.refreshToken.updateMany({
      where: { userId, revoked: false },
      data: { revoked: true, revokedAt: new Date() },
    });

    await this.auditService.log({
      action: AUTH.AUDIT_ACTIONS.PASSWORD_CHANGE,
      userId,
      details: {},
    });
  }
}