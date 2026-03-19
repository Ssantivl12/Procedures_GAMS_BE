import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DocumentGroup, ProcedureStatus } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../db/prisma.service';
import { AuditService } from '../audit/audit.service';
import { StorageService } from './storage/storage.service';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { QueryDocumentsDto } from './dto/query-documents.dto';
import { MulterFile } from './interfaces/multer-file.interface';
import {
  CYCLE_FORBIDDEN_GROUPS,
  CYCLE_REQUIRED_GROUPS,
  DOCUMENT_AUDIT_ACTIONS,
  DOCUMENT_MESSAGES,
} from '../common/constants/document.constants';

const MAX_FILE_SIZE_BYTES =
  (parseInt(process.env.UPLOAD_MAX_SIZE_MB ?? '20', 10) || 20) * 1024 * 1024;
const ALLOWED_MIME_TYPES = (process.env.UPLOAD_ALLOWED_TYPES ?? 'application/pdf').split(',');

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
  ) {}

  // -------------------------------------------------------------------------
  // Shared include for uploadedBy
  // -------------------------------------------------------------------------
  private readonly documentInclude = {
    uploadedBy: { select: { id: true, firstName: true, lastName: true } },
  } as const;

  // -------------------------------------------------------------------------
  // Upload — POST /procedures/:procedureId/documents
  // -------------------------------------------------------------------------
  async upload(
    procedureId: string,
    dto: UploadDocumentDto,
    file: MulterFile,
    userId: string,
  ) {
    // 1. Validate file
    if (!file) throw new BadRequestException(DOCUMENT_MESSAGES.ERROR.NO_FILE);
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(DOCUMENT_MESSAGES.ERROR.INVALID_MIME);
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException('File exceeds the 20 MB limit');
    }
    // Magic bytes check: first 4 bytes must be %PDF (0x25 0x50 0x44 0x46)
    if (
      !file.buffer ||
      file.buffer.length < 4 ||
      file.buffer[0] !== 0x25 ||
      file.buffer[1] !== 0x50 ||
      file.buffer[2] !== 0x44 ||
      file.buffer[3] !== 0x46
    ) {
      throw new BadRequestException(DOCUMENT_MESSAGES.ERROR.INVALID_MIME);
    }

    // 2. Validate procedure exists
    const procedure = await this.prisma.procedure.findFirst({
      where: { id: procedureId, isActive: true, deletedAt: null },
    });
    if (!procedure) {
      throw new NotFoundException(DOCUMENT_MESSAGES.ERROR.PROCEDURE_NOT_FOUND);
    }

    // 3. cycleId validation
    const { docGroup, cycleId, description } = dto;

    if ((CYCLE_REQUIRED_GROUPS as readonly string[]).includes(docGroup) && !cycleId) {
      throw new BadRequestException(DOCUMENT_MESSAGES.ERROR.CYCLE_REQUIRED);
    }

    if ((CYCLE_FORBIDDEN_GROUPS as readonly string[]).includes(docGroup) && cycleId) {
      throw new BadRequestException(
        `cycleId must not be provided for ${docGroup}`,
      );
    }

    if (cycleId) {
      const cycle = await this.prisma.procedureCycle.findFirst({
        where: { id: cycleId, procedureId, isActive: true },
      });
      if (!cycle) {
        throw new NotFoundException(DOCUMENT_MESSAGES.ERROR.CYCLE_NOT_FOUND);
      }
    }

    // 4. RESULTADO_FINAL: procedure must be CERRADO
    if (
      docGroup === DocumentGroup.RESULTADO_FINAL &&
      procedure.currentStatus !== ProcedureStatus.CERRADO
    ) {
      throw new ConflictException(
        DOCUMENT_MESSAGES.ERROR.RESULTADO_FINAL_NOT_CLOSED,
      );
    }

    // 5. Duplicate checksum check
    const checksum = this.storage.computeChecksum(file.buffer);
    const existing = await this.prisma.document.findFirst({
      where: { procedureId, checksum, isActive: true },
    });
    if (existing) {
      throw new ConflictException(
        DOCUMENT_MESSAGES.ERROR.DUPLICATE_CHECKSUM(existing.version),
      );
    }

    // 6. Determine version (MAX within procedureId + docGroup)
    const maxVersionDoc = await this.prisma.document.findFirst({
      where: { procedureId, docGroup, isActive: true },
      orderBy: { version: 'desc' },
    });
    const newVersion = maxVersionDoc ? maxVersionDoc.version + 1 : 1;
    const newDocId = uuidv4();

    // 7. Build storage key and write to disk FIRST
    const storageKey = this.storage.buildStorageKey(
      procedureId,
      cycleId ?? null,
      docGroup,
      newVersion,
      newDocId,
    );
    await this.storage.writeToDisk(storageKey, file.buffer);

    // 8. Versioning transaction: mark previous isLatest=false + insert new
    const doc = await this.prisma.$transaction(async (tx) => {
      // Mark previous latest as superseded
      if (maxVersionDoc) {
        await tx.document.update({
          where: { id: maxVersionDoc.id },
          data: { isLatest: false, replacedById: newDocId },
        });
      }

      return tx.document.create({
        data: {
          id: newDocId,
          procedureId,
          cycleId: cycleId ?? null,
          docGroup,
          fileName: `v${newVersion}_${newDocId}.pdf`,
          storageKey,
          mimeType: 'application/pdf',
          originalFileName: file.originalname,
          fileSize: file.size,
          checksum,
          description: description ?? null,
          version: newVersion,
          isLatest: true,
          uploadedByUserId: userId,
        },
        include: this.documentInclude,
      });
    });

    await this.audit.log({
      action: DOCUMENT_AUDIT_ACTIONS.UPLOADED,
      userId,
      details: { procedureId, docGroup, version: newVersion },
    });

    return this.mapToResponse(doc);
  }

  // -------------------------------------------------------------------------
  // List — GET /procedures/:procedureId/documents
  // -------------------------------------------------------------------------
  async findAll(procedureId: string, query: QueryDocumentsDto) {
    await this.assertProcedureExists(procedureId);

    const {
      cycleId,
      docGroup,
      isLatest = true,
      page = 1,
      limit = 20,
    } = query;

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {
      procedureId,
      isActive: true,
      ...(cycleId ? { cycleId } : {}),
      ...(docGroup ? { docGroup } : {}),
      ...(isLatest !== undefined ? { isLatest } : {}),
    };

    const [docs, total] = await Promise.all([
      this.prisma.document.findMany({
        where,
        skip,
        take: limitNum,
        include: this.documentInclude,
        orderBy: [{ docGroup: 'asc' }, { version: 'desc' }],
      }),
      this.prisma.document.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limitNum);
    return {
      data: docs.map((d) => this.mapToResponse(d)),
      meta: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages,
        hasNextPage: pageNum < totalPages,
        hasPreviousPage: pageNum > 1,
      },
    };
  }

  // -------------------------------------------------------------------------
  // Get one — GET /procedures/:procedureId/documents/:id
  // -------------------------------------------------------------------------
  async findOne(procedureId: string, id: string) {
    const doc = await this.findActiveDoc(procedureId, id);
    return this.mapToResponse(doc);
  }

  // -------------------------------------------------------------------------
  // Download — GET /procedures/:procedureId/documents/:id/download
  // Returns storageKey and metadata for the controller to stream
  // -------------------------------------------------------------------------
  async getDownloadMeta(procedureId: string, id: string) {
    const doc = await this.findActiveDoc(procedureId, id);
    return {
      storageKey: doc.storageKey,
      originalFileName: doc.originalFileName ?? `document_v${doc.version}.pdf`,
      fileSize: doc.fileSize,
    };
  }

  // -------------------------------------------------------------------------
  // Version history — GET /procedures/:procedureId/documents/:id/versions
  // -------------------------------------------------------------------------
  async getVersionHistory(procedureId: string, id: string) {
    const doc = await this.findActiveDoc(procedureId, id);

    const versions = await this.prisma.document.findMany({
      where: {
        procedureId,
        docGroup: doc.docGroup,
        isActive: true,
      },
      include: this.documentInclude,
      orderBy: { version: 'desc' },
    });

    return versions.map((d) => this.mapToResponse(d));
  }

  // -------------------------------------------------------------------------
  // Soft delete — DELETE /procedures/:procedureId/documents/:id
  // -------------------------------------------------------------------------
  async remove(procedureId: string, id: string, userId: string) {
    const doc = await this.findActiveDoc(procedureId, id);

    await this.prisma.document.update({
      where: { id: doc.id },
      data: { isActive: false, deletedAt: new Date() },
    });

    await this.audit.log({
      action: DOCUMENT_AUDIT_ACTIONS.DELETED,
      userId,
      details: { procedureId, docId: id },
    });

    return { message: DOCUMENT_MESSAGES.SUCCESS.DELETED };
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------
  private async assertProcedureExists(procedureId: string) {
    const exists = await this.prisma.procedure.findFirst({
      where: { id: procedureId, isActive: true, deletedAt: null },
      select: { id: true },
    });
    if (!exists) {
      throw new NotFoundException(DOCUMENT_MESSAGES.ERROR.PROCEDURE_NOT_FOUND);
    }
  }

  private async findActiveDoc(procedureId: string, id: string) {
    const doc = await this.prisma.document.findFirst({
      where: { id, procedureId, isActive: true },
      include: this.documentInclude,
    });
    if (!doc) throw new NotFoundException(DOCUMENT_MESSAGES.ERROR.NOT_FOUND);
    return doc;
  }

  private mapToResponse(doc: any) {
    return {
      id: doc.id,
      procedureId: doc.procedureId,
      cycleId: doc.cycleId ?? null,
      docGroup: doc.docGroup,
      originalFileName: doc.originalFileName ?? null,
      fileSize: doc.fileSize ? Number(doc.fileSize) : null,
      mimeType: doc.mimeType,
      description: doc.description ?? null,
      version: doc.version,
      isLatest: doc.isLatest,
      uploadedBy: doc.uploadedBy
        ? {
            id: doc.uploadedBy.id,
            fullName: `${doc.uploadedBy.firstName} ${doc.uploadedBy.lastName}`.trim(),
          }
        : null,
      uploadedAt: doc.uploadedAt,
      downloadUrl: `/procedures/${doc.procedureId}/documents/${doc.id}/download`,
    };
  }
}
