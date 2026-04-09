import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';

export type SnapshotEntityType = 'PROCEDURE' | 'OBSERVATION';

@Injectable()
export class SnapshotService {
  private readonly logger = new Logger(SnapshotService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Fire-and-forget full-state snapshot of an entity at the moment of a write operation.
   * Failures are swallowed and logged to the console — never block the main request.
   */
  save(data: {
    entityType: SnapshotEntityType;
    entityId: string;
    action: string;
    changedById?: string | null;
    snapshotData: Record<string, any>;
  }): void {
    this.prisma.entitySnapshot
      .create({
        data: {
          entityType: data.entityType,
          entityId: data.entityId,
          action: data.action,
          changedById: data.changedById ?? null,
          snapshotData: data.snapshotData,
        },
      })
      .catch((error: Error) => {
        this.logger.error(
          `Failed to create snapshot [${data.entityType}/${data.entityId}/${data.action}]: ${error.message}`,
          error.stack,
        );
      });
  }
}
