import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly basePath: string;

  constructor(private readonly configService: ConfigService) {
    this.basePath = configService.get<string>('UPLOAD_BASE_PATH', '/var/uploads/iraps');
  }

  // -----------------------------------------------------------------------
  // SHA-256 checksum from buffer
  // -----------------------------------------------------------------------
  computeChecksum(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  // -----------------------------------------------------------------------
  // Build storage key (relative path from basePath)
  // Structure:
  //   with cycle:    {procedureId}/{cycleId}/{docGroup}/v{version}_{docId}.pdf
  //   without cycle: {procedureId}/{docGroup}/v{version}_{docId}.pdf
  // -----------------------------------------------------------------------
  buildStorageKey(
    procedureId: string,
    cycleId: string | null,
    docGroup: string,
    version: number,
    docId: string,
  ): string {
    const segments = cycleId
      ? [procedureId, cycleId, docGroup]
      : [procedureId, docGroup];
    return path.join(...segments, `v${version}_${docId}.pdf`);
  }

  // -----------------------------------------------------------------------
  // Full absolute path from storage key — guarded against path traversal
  // -----------------------------------------------------------------------
  getFullPath(storageKey: string): string {
    const resolved = path.resolve(this.basePath, storageKey);
    const base = path.resolve(this.basePath);
    if (!resolved.startsWith(base + path.sep) && resolved !== base) {
      throw new InternalServerErrorException('Invalid storage path');
    }
    return resolved;
  }

  // -----------------------------------------------------------------------
  // Write buffer to disk. Creates directories if needed.
  // Throws InternalServerErrorException on failure.
  // -----------------------------------------------------------------------
  async writeToDisk(storageKey: string, buffer: Buffer): Promise<void> {
    const fullPath = this.getFullPath(storageKey);
    const dir = path.dirname(fullPath);

    try {
      await fs.promises.mkdir(dir, { recursive: true });
      await fs.promises.writeFile(fullPath, buffer);
    } catch (err) {
      this.logger.error(`Failed to write file to disk: ${fullPath}`, err);
      throw new InternalServerErrorException('Failed to write file to disk');
    }
  }

  // -----------------------------------------------------------------------
  // Create a readable stream for download
  // -----------------------------------------------------------------------
  createReadStream(storageKey: string): fs.ReadStream {
    const fullPath = this.getFullPath(storageKey);
    return fs.createReadStream(fullPath);
  }

  // -----------------------------------------------------------------------
  // Check if the physical file exists (for download safety)
  // -----------------------------------------------------------------------
  async fileExists(storageKey: string): Promise<boolean> {
    const fullPath = this.getFullPath(storageKey);
    try {
      await fs.promises.access(fullPath, fs.constants.R_OK);
      return true;
    } catch {
      return false;
    }
  }
}
