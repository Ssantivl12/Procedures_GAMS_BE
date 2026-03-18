export const DOCUMENT_MESSAGES = {
  ERROR: {
    NOT_FOUND: 'Document not found',
    PROCEDURE_NOT_FOUND: 'Procedure not found or inactive',
    CYCLE_NOT_FOUND: 'Cycle not found or does not belong to this procedure',
    CYCLE_REQUIRED: 'cycleId is required for this document group',
    RESULTADO_FINAL_NOT_CLOSED: 'RESULTADO_FINAL can only be uploaded when the procedure is CERRADO',
    DUPLICATE_CHECKSUM: (version: number) =>
      `Este archivo ya fue subido anteriormente en este trámite (versión ${version})`,
    ALREADY_DELETED: 'Document is already deleted',
    NO_FILE: 'No file was provided',
    INVALID_MIME: 'Only PDF files are accepted',
    WRITE_FAILED: 'Failed to write file to disk',
  },
  SUCCESS: {
    DELETED: 'Document deleted successfully',
  },
} as const;

export const DOCUMENT_AUDIT_ACTIONS = {
  UPLOADED: 'DOCUMENT_UPLOADED',
  DELETED: 'DOCUMENT_DELETED',
} as const;

/** Document groups that require a cycleId */
export const CYCLE_REQUIRED_GROUPS = ['ACTA', 'INFORME', 'OBSERVACIONES', 'REINGRESO'] as const;

/** Document groups where cycleId must be null */
export const CYCLE_FORBIDDEN_GROUPS = ['RESULTADO_FINAL'] as const;
