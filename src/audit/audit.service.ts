import { Injectable } from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) { }

  /**
   * Registra una acción de auditoría de seguridad.
   * Se ejecuta de forma asíncrona; no se espera el resultado.
   */
  async log(data: {
    action: string;
    userId?: string | null;
    details?: Record<string, any>;
  }): Promise<void> {
    // No usar await para no bloquear el flujo principal
    this.prisma.auditLog
      .create({
        data: {
          action: data.action,
          userId: data.userId ?? undefined,
          details: data.details ?? {},
        },
      })
      .catch((error) => {
        // Loggear error interno (usar logger en producción)
        console.error('Failed to create audit log:', error);
      });
  }
}