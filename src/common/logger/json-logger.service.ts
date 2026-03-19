import { LoggerService } from '@nestjs/common';
import { requestContext } from './request-context';

export class JsonLoggerService implements LoggerService {
  private write(level: string, message: unknown, context?: string, stack?: string): void {
    const entry: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      level,
      context: context ?? 'App',
      message,
      correlationId: requestContext.getStore()?.correlationId ?? '-',
    };
    if (stack) entry.stack = stack;
    process.stdout.write(JSON.stringify(entry) + '\n');
  }

  log(message: unknown, context?: string): void {
    this.write('log', message, context);
  }

  error(message: unknown, stack?: string, context?: string): void {
    this.write('error', message, context, stack);
  }

  warn(message: unknown, context?: string): void {
    this.write('warn', message, context);
  }

  debug(message: unknown, context?: string): void {
    this.write('debug', message, context);
  }

  verbose(message: unknown, context?: string): void {
    this.write('verbose', message, context);
  }
}
