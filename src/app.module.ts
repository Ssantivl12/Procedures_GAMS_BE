import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import * as Joi from 'joi';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AuditModule } from './audit/audit.module';
import { CompaniesModule } from './companies/companies.module';
import { CasesModule } from './cases/cases.module';
import { ProceduresModule } from './procedures/procedures.module';
import { ObservationsModule } from './observations/observations.module';
import { DocumentsModule } from './documents/documents.module';
import { ConfigurationModule } from './configuration/configuration.module';
import { ReportsModule } from './reports/reports.module';
import { DbModule } from './db/db.module';
import { AUTH } from './common/constants/auth.constants';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      //validacion para las variables de entorno
      validationSchema: Joi.object({
        JWT_SECRET: Joi.string().min(32).required(),
        JWT_EXPIRES_IN: Joi.string().default('1h'),
        REFRESH_TOKEN_EXPIRES_IN: Joi.string().default('7d'),
        DATABASE_URL: Joi.string().required(),
        FRONTEND_URL: Joi.string().uri().default('http://localhost:5173'),
        UPLOAD_MAX_SIZE_MB: Joi.number().integer().min(1).max(100).default(20),
        UPLOAD_ALLOWED_TYPES: Joi.string().default('application/pdf'),
      }),
    }),
    ThrottlerModule.forRoot([
      { name: 'login', ttl: AUTH.RATE_LIMIT.LOGIN.ttl, limit: AUTH.RATE_LIMIT.LOGIN.limit },
      { name: 'password', ttl: AUTH.RATE_LIMIT.PASSWORD.ttl, limit: AUTH.RATE_LIMIT.PASSWORD.limit },
    ]),
    ScheduleModule.forRoot(),
    DbModule,
    UsersModule,
    AuditModule,
    AuthModule,
    CompaniesModule,
    CasesModule,
    ProceduresModule,
    ObservationsModule,
    DocumentsModule,
    ConfigurationModule,
    ReportsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
