import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../db/prisma.service';

/**
 * Runs daily to delete refresh tokens that are either expired or already revoked.
 * Keeps the refresh_token table small and prevents leaking stale credentials.
 */
@Injectable()
export class AuthSchedulerService {
  private readonly logger = new Logger(AuthSchedulerService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Every day at 02:00 AM — offset from the procedure scheduler (00:05)
  @Cron('0 2 * * *')
  async purgeExpiredTokens() {
    this.logger.log('Purging expired/revoked refresh tokens');

    const result = await this.prisma.refreshToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { revoked: true },
        ],
      },
    });

    this.logger.log(`Purged ${result.count} expired/revoked refresh tokens`);
  }
}
