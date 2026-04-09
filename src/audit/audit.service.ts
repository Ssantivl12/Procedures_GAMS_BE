import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) { }

  private async write(data: {
    action: string;
    userId?: string | null;
    entityType?: string | null;
    entityId?: string | null;
    details?: Record<string, any>;
  }): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        action: data.action,
        userId: data.userId ?? undefined,
        entityType: data.entityType ?? undefined,
        entityId: data.entityId ?? undefined,
        details: data.details ?? {},
      },
    });
  }

  /**
   * Fire-and-forget audit log for non-critical operational events.
   * Failures are swallowed and logged to the console.
   */
  log(data: {
    action: string;
    userId?: string | null;
    entityType?: string | null;
    entityId?: string | null;
    details?: Record<string, any>;
  }): void {
    this.write(data).catch((error: Error) => {
      this.logger.error(`Failed to create audit log [${data.action}]: ${error.message}`, error.stack);
    });
  }

  /**
   * Awaited audit log for security-critical events (login, logout, password changes).
   * Failures propagate to the caller.
   */
  async logCritical(data: {
    action: string;
    userId?: string | null;
    entityType?: string | null;
    entityId?: string | null;
    details?: Record<string, any>;
  }): Promise<void> {
    await this.write(data);
  }
}