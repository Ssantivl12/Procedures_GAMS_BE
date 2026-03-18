import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import * as Joi from 'joi';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AuditModule } from './audit/audit.module';
import { CompaniesModule } from './companies/companies.module';
import { CasesModule } from './cases/cases.module';
import { PrismaService } from './db/prisma.service';
import { AUTH } from './common/constants/auth.constants';

@Module({
  imports: [
    ConfigModule.forRoot({
      //validacion para las variables de entorno
      validationSchema: Joi.object({
        JWT_SECRET: Joi.string().min(32).required(),
        JWT_EXPIRES_IN: Joi.string().default('1h'),
        REFRESH_TOKEN_EXPIRES_IN: Joi.string().default('7d'),
        DATABASE_URL: Joi.string().required(),
      }),
    }),
    ThrottlerModule.forRoot([
      {
        ttl: AUTH.RATE_LIMIT.LOGIN.ttl,
        limit: AUTH.RATE_LIMIT.LOGIN.limit,
      },
    ]),
    UsersModule,
    AuditModule,
    AuthModule,
    CompaniesModule,
    CasesModule,
  ],
  controllers: [AppController],
  providers: [AppService, PrismaService],
})
export class AppModule {}
