import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AUTH } from '../common/constants/auth.constants';
import { USER_MESSAGES } from '../common/constants/user.constants';
import { PrismaService } from '../db/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: createUserDto.email },
    });

    if (existingUser) {
      throw new ConflictException(USER_MESSAGES.ERROR.EMAIL_ALREADY_EXISTS);
    }

    const rolesToAdd = await this.prisma.role.findMany({
      where: { name: { in: createUserDto.roles } },
    });

    if (rolesToAdd.length !== createUserDto.roles.length) {
      throw new BadRequestException(USER_MESSAGES.ERROR.INVALID_ROLES);
    }

    const saltRounds = AUTH.PASSWORD.BCRYPT_ROUNDS;
    const passwordHash = await bcrypt.hash(createUserDto.password, saltRounds);

    const user = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: createUserDto.email,
          passwordHash,
          fullName: createUserDto.fullName,
        },
      });

      await tx.userRole.createMany({
        data: rolesToAdd.map((role) => ({
          userId: newUser.id,
          roleId: role.id,
        })),
      });

      return newUser;
    });

    return this.mapToResponse(await this.findById(user.id));
  }

  async findAll() {
    const users = await this.prisma.user.findMany({
      where: { deletedAt: null },
      include: {
        roles: {
          include: { role: true },
          where: { revokedAt: null },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return users.map((user) => this.mapToResponse(user));
  }

  async findOne(id: bigint) {
    const user = await this.findById(id);
    return this.mapToResponse(user);
  }

  async update(id: bigint, updateUserDto: UpdateUserDto) {
    const user = await this.findById(id);

    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const existing = await this.prisma.user.findUnique({
        where: { email: updateUserDto.email },
      });
      if (existing) {
        throw new ConflictException(USER_MESSAGES.ERROR.EMAIL_IN_USE);
      }
    }

    let passwordHash: string | undefined;
    if (updateUserDto.password) {
      const saltRounds = AUTH.PASSWORD.BCRYPT_ROUNDS;
      passwordHash = await bcrypt.hash(updateUserDto.password, saltRounds);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: {
          email: updateUserDto.email,
          fullName: updateUserDto.fullName,
          isActive: updateUserDto.isActive,
          passwordHash,
        },
      });

      if (updateUserDto.roles) {
        const newRoles = await tx.role.findMany({
          where: { name: { in: updateUserDto.roles } },
        });

        if (newRoles.length !== updateUserDto.roles.length) {
          throw new BadRequestException(USER_MESSAGES.ERROR.INVALID_ROLES);
        }

        const currentAssignments = await tx.userRole.findMany({
          where: { userId: id },
          include: { role: true },
        });

        const newRoleIds = newRoles.map((r) => r.id);

        // Revocar roles activos que no están en la nueva lista
        await tx.userRole.updateMany({
          where: {
            userId: id,
            roleId: { notIn: newRoleIds },
            revokedAt: null,
          },
          data: { revokedAt: new Date() },
        });

        // Asignar o reactivar roles
        for (const role of newRoles) {
          const assignment = currentAssignments.find(
            (a) => a.roleId === role.id,
          );

          if (assignment) {
            if (assignment.revokedAt) {
              await tx.userRole.update({
                where: { userId_roleId: { userId: id, roleId: role.id } },
                data: { revokedAt: null, assignedAt: new Date() },
              });
            }
          } else {
            await tx.userRole.create({
              data: { userId: id, roleId: role.id },
            });
          }
        }
      }
    });

    return this.mapToResponse(await this.findById(id));
  }

  async remove(id: bigint) {
    await this.findById(id);
    await this.prisma.user.update({
      where: { id },
      data: {
        isActive: false,
        deletedAt: new Date(),
      },
    });
    return { message: USER_MESSAGES.SUCCESS.USER_DELETED };
  }

  // Método usado internamente y por Auth module (devuelve objeto con BigInt)
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

    if (!user || user.deletedAt) {
      throw new NotFoundException(USER_MESSAGES.ERROR.NOT_FOUND);
    }

    return user;
  }

  private mapToResponse(user: any) {
    return {
      id: user.id.toString(),
      email: user.email,
      fullName: user.fullName,
      isActive: user.isActive,
      roles: user.roles.map((ur) => ur.role.name),
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    };
  }
}
