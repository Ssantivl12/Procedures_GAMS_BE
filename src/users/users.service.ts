import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import { AUTH } from '../common/constants/auth.constants';
import { USER_MESSAGES } from '../common/constants/user.constants';
import { UserRole } from '../common/constants/role.constants';
import { PrismaService } from '../db/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { QueryUsersDto } from './dto/query-users.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // create
  // ---------------------------------------------------------------------------

  async create(createUserDto: CreateUserDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: createUserDto.email },
    });
    if (existingUser) {
      throw new ConflictException(USER_MESSAGES.ERROR.EMAIL_ALREADY_EXISTS);
    }

    // Deduplicate roles before validation to avoid false length mismatch
    const uniqueRoles = [...new Set(createUserDto.roles)];
    const rolesToAdd = await this.prisma.role.findMany({
      where: { name: { in: uniqueRoles } },
    });
    if (rolesToAdd.length !== uniqueRoles.length) {
      throw new BadRequestException(USER_MESSAGES.ERROR.INVALID_ROLES);
    }

    const passwordHash = await bcrypt.hash(
      createUserDto.password,
      AUTH.PASSWORD.BCRYPT_ROUNDS,
    );

    const user = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: createUserDto.email,
          passwordHash,
          firstName: createUserDto.firstName,
          lastName: createUserDto.lastName,
        },
      });
      await tx.userRole.createMany({
        data: rolesToAdd.map((role) => ({ userId: newUser.id, roleId: role.id })),
      });
      return newUser;
    });

    return this.mapToResponse(await this.findById(user.id));
  }

  // ---------------------------------------------------------------------------
  // findAll — paginated with search and role filter
  // ---------------------------------------------------------------------------

  async findAll(query: QueryUsersDto, requestingUserRoles: string[]) {
    const { page = 1, limit = 20, search, isActive, role } = query;
    const pageNum = Number(page);
    const limitNum = Number(limit);
    const skip = (pageNum - 1) * limitNum;

    const isSuperAdmin = requestingUserRoles.includes(UserRole.SUPERADMIN);

    const where: Prisma.UserWhereInput = {
      deletedAt: null,
    };

    if (isSuperAdmin && isActive !== undefined) {
      where.isActive = isActive;
    } else if (!isSuperAdmin) {
      where.isActive = true;
    }

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (role) {
      where.roles = { some: { role: { name: role }, revokedAt: null } };
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limitNum,
        include: { roles: { include: { role: true }, where: { revokedAt: null } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limitNum);

    return {
      data: users.map((u) => this.mapToResponse(u)),
      meta: { total, page: pageNum, limit: limitNum, totalPages,
        hasNextPage: pageNum < totalPages, hasPreviousPage: pageNum > 1 },
    };
  }

  // ---------------------------------------------------------------------------
  // findOne / findMe
  // ---------------------------------------------------------------------------

  async findOne(id: string) {
    return this.mapToResponse(await this.findById(id));
  }

  async findMe(userId: string) {
    return this.mapToResponse(await this.findById(userId));
  }

  // ---------------------------------------------------------------------------
  // update
  // ---------------------------------------------------------------------------

  async update(id: string, updateUserDto: UpdateUserDto) {
    const user = await this.findById(id);

    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const existing = await this.prisma.user.findUnique({
        where: { email: updateUserDto.email },
      });
      if (existing) throw new ConflictException(USER_MESSAGES.ERROR.EMAIL_IN_USE);
    }

    let passwordHash: string | undefined;
    if (updateUserDto.password) {
      passwordHash = await bcrypt.hash(updateUserDto.password, AUTH.PASSWORD.BCRYPT_ROUNDS);
    }

    await this.prisma.$transaction(async (tx) => {
      const data: Prisma.UserUpdateInput = {};
      if (updateUserDto.email !== undefined) data.email = updateUserDto.email;
      if (updateUserDto.firstName !== undefined) data.firstName = updateUserDto.firstName;
      if (updateUserDto.lastName !== undefined) data.lastName = updateUserDto.lastName;
      if (updateUserDto.isActive !== undefined) data.isActive = updateUserDto.isActive;
      if (passwordHash !== undefined) data.passwordHash = passwordHash;

      await tx.user.update({ where: { id }, data });

      if (updateUserDto.roles !== undefined) {
        const uniqueRoles = [...new Set(updateUserDto.roles)];
        const newRoles = await tx.role.findMany({ where: { name: { in: uniqueRoles } } });
        if (newRoles.length !== uniqueRoles.length) {
          throw new BadRequestException(USER_MESSAGES.ERROR.INVALID_ROLES);
        }

        const newRoleIds = newRoles.map((r) => r.id);
        const currentAssignments = await tx.userRole.findMany({ where: { userId: id } });

        await tx.userRole.updateMany({
          where: { userId: id, roleId: { notIn: newRoleIds }, revokedAt: null },
          data: { revokedAt: new Date() },
        });

        for (const role of newRoles) {
          const existing = currentAssignments.find((a) => a.roleId === role.id);
          if (existing) {
            if (existing.revokedAt) {
              await tx.userRole.update({
                where: { userId_roleId: { userId: id, roleId: role.id } },
                data: { revokedAt: null, assignedAt: new Date() },
              });
            }
          } else {
            await tx.userRole.create({ data: { userId: id, roleId: role.id } });
          }
        }
      }
    });

    return this.mapToResponse(await this.findById(id));
  }

  // ---------------------------------------------------------------------------
  // remove (soft delete)
  // ---------------------------------------------------------------------------

  async remove(id: string, requestingUserId: string) {
    if (id === requestingUserId) {
      throw new ForbiddenException(USER_MESSAGES.ERROR.CANNOT_DELETE_SELF);
    }
    await this.findById(id);
    await this.prisma.user.update({
      where: { id },
      data: { isActive: false, deletedAt: new Date() },
    });
    return { message: USER_MESSAGES.SUCCESS.USER_DELETED };
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      include: { roles: { include: { role: true }, where: { revokedAt: null } } },
    });
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { roles: { include: { role: true }, where: { revokedAt: null } } },
    });
    if (!user || user.deletedAt) throw new NotFoundException(USER_MESSAGES.ERROR.NOT_FOUND);
    return user;
  }

  private mapToResponse(user: any) {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: `${user.firstName} ${user.lastName}`.trim(),
      isActive: user.isActive,
      roles: user.roles.map((ur: any) => ur.role.name),
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    };
  }
}
