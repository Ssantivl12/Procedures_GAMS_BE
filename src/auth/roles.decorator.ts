import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../common/constants/role.constants';

export const Roles = (...roles: UserRole[]) => SetMetadata('roles', roles);