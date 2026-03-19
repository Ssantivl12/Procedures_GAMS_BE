import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { UserRole } from '../common/constants/role.constants';
import { DocumentsService } from './documents.service';
import { StorageService } from './storage/storage.service';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { QueryDocumentsDto } from './dto/query-documents.dto';

// multer defaults to memoryStorage when no storage option is provided — no direct import needed

@Controller('procedures/:procedureId/documents')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DocumentsController {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly storageService: StorageService,
  ) {}

  // -----------------------------------------------------------------------
  // POST /procedures/:procedureId/documents
  // -----------------------------------------------------------------------
  @Post()
  @Roles(UserRole.SUPERADMIN, UserRole.ENCARGADO, UserRole.SECRETARIA, UserRole.INSPECTOR)
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: (parseInt(process.env.UPLOAD_MAX_SIZE_MB ?? '20', 10) || 20) * 1024 * 1024 },
    }),
  )
  upload(
    @Param('procedureId') procedureId: string,
    @UploadedFile() file: any,
    @Query() dto: UploadDocumentDto,
    @Req() req: any,
  ) {
    return this.documentsService.upload(procedureId, dto, file, req.user.sub);
  }

  // -----------------------------------------------------------------------
  // GET /procedures/:procedureId/documents
  // -----------------------------------------------------------------------
  @Get()
  @Roles(UserRole.SUPERADMIN, UserRole.ENCARGADO, UserRole.SECRETARIA, UserRole.INSPECTOR)
  findAll(
    @Param('procedureId') procedureId: string,
    @Query() query: QueryDocumentsDto,
  ) {
    return this.documentsService.findAll(procedureId, query);
  }

  // -----------------------------------------------------------------------
  // IMPORTANT: Specific sub-routes (:id/download, :id/versions) must be
  // declared BEFORE the generic :id route to avoid route shadowing.
  // -----------------------------------------------------------------------

  // GET /procedures/:procedureId/documents/:id/download
  @Get(':id/download')
  @Roles(UserRole.SUPERADMIN, UserRole.ENCARGADO, UserRole.SECRETARIA, UserRole.INSPECTOR)
  async download(
    @Param('procedureId') procedureId: string,
    @Param('id') id: string,
    @Res() res: any,
  ) {
    const meta = await this.documentsService.getDownloadMeta(procedureId, id);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(meta.originalFileName)}"`,
    );
    if (meta.fileSize) {
      res.setHeader('Content-Length', String(meta.fileSize));
    }

    this.storageService.createReadStream(meta.storageKey).pipe(res);
  }

  // GET /procedures/:procedureId/documents/:id/versions
  @Get(':id/versions')
  @Roles(UserRole.SUPERADMIN, UserRole.ENCARGADO, UserRole.SECRETARIA, UserRole.INSPECTOR)
  getVersionHistory(
    @Param('procedureId') procedureId: string,
    @Param('id') id: string,
  ) {
    return this.documentsService.getVersionHistory(procedureId, id);
  }

  // GET /procedures/:procedureId/documents/:id
  @Get(':id')
  @Roles(UserRole.SUPERADMIN, UserRole.ENCARGADO, UserRole.SECRETARIA, UserRole.INSPECTOR)
  findOne(
    @Param('procedureId') procedureId: string,
    @Param('id') id: string,
  ) {
    return this.documentsService.findOne(procedureId, id);
  }

  // DELETE /procedures/:procedureId/documents/:id
  @Delete(':id')
  @Roles(UserRole.SUPERADMIN)
  @HttpCode(HttpStatus.OK)
  remove(
    @Param('procedureId') procedureId: string,
    @Param('id') id: string,
    @Req() req: any,
  ) {
    return this.documentsService.remove(procedureId, id, req.user.sub);
  }
}
