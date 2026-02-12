import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';
import { UserRole } from '../common/constants/role.constants';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      include: {
        roles: {
          include: { role: true },
          where: { revokedAt: null },
        },
      },
    });
  }

  async findById(id: bigint) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        roles: {
          include: { role: true },
          where: { revokedAt: null },
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  // Método para creación de usuarios – SOLO para SUPERADMIN
  // La autorización se aplica en el controlador (UsersController)
  async createUser(data: {
    email: string;
    password: string;
    fullName: string;
    roles: UserRole[];
  }) {
    // Implementación completa con bcrypt y transacción
    // Se incluirá en el módulo de usuarios completo
    throw new Error('Not implemented - use UsersModule with SUPERADMIN guard');
  }
}