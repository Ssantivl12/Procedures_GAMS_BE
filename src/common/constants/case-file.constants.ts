export const CASE_FILE_MESSAGES = {
  ERROR: {
    NOT_FOUND: 'Case file not found',
    COMPANY_NOT_FOUND: 'Company not found or inactive',
    ALREADY_EXISTS: 'Company already has a case file',
    FILE_NUMBER_EXISTS: 'File number already exists',
    HAS_ACTIVE_PROCEDURES: 'Cannot close: case file has active procedures',
    HAS_ANY_PROCEDURES: 'Cannot delete: case file has associated procedures',
    ALREADY_CLOSED: 'Case file is already closed',
    NOT_CLOSED: 'Case file is not closed',
    ALREADY_DELETED: 'Case file already deleted',
    FORBIDDEN_INACTIVE: 'Only SUPERADMIN can view deleted case files',
  },
  SUCCESS: {
    CLOSED: 'Case file closed successfully',
    REOPENED: 'Case file reopened successfully',
    DELETED: 'Case file deleted successfully',
  },
} as const;

export const CASE_FILE_AUDIT_ACTIONS = {
  CREATED: 'CASE_FILE_CREATED',
  UPDATED: 'CASE_FILE_UPDATED',
  CLOSED: 'CASE_FILE_CLOSED',
  REOPENED: 'CASE_FILE_REOPENED',
  DELETED: 'CASE_FILE_DELETED',
} as const;

// Estados que bloquean el cierre del expediente (contract §5.2)
export const ACTIVE_PROCEDURE_STATUSES = [
  'RECIBIDO',
  'EN_REVISION',
  'OBSERVADO_PENDIENTE_RECOJO',
  'SUBSANACION_PENDIENTE_REINGRESO',
] as const;
