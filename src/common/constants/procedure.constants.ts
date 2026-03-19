import { ProcedureStatus, ProcedureTypeCode } from '@prisma/client';
import { UserRole } from './role.constants';

// ---------------------------------------------------------------------------
// Transition map — only valid next states (ABANDONADO handled separately)
// ---------------------------------------------------------------------------
export const TRANSITIONS_MAP: Partial<Record<ProcedureStatus, ProcedureStatus[]>> = {
  [ProcedureStatus.RECIBIDO]: [ProcedureStatus.EN_REVISION],
  [ProcedureStatus.EN_REVISION]: [
    ProcedureStatus.OBSERVADO_PENDIENTE_RECOJO,
    ProcedureStatus.CERRADO,
  ],
  [ProcedureStatus.OBSERVADO_PENDIENTE_RECOJO]: [
    ProcedureStatus.SUBSANACION_PENDIENTE_REINGRESO,
  ],
  [ProcedureStatus.SUBSANACION_PENDIENTE_REINGRESO]: [ProcedureStatus.EN_REVISION],
};

// Active statuses — can transition to ABANDONADO
export const ACTIVE_PROCEDURE_STATUSES_SET: ProcedureStatus[] = [
  ProcedureStatus.RECIBIDO,
  ProcedureStatus.EN_REVISION,
  ProcedureStatus.OBSERVADO_PENDIENTE_RECOJO,
  ProcedureStatus.SUBSANACION_PENDIENTE_REINGRESO,
];

// ---------------------------------------------------------------------------
// Role map per transition key "FROM→TO"
// ---------------------------------------------------------------------------
export const TRANSITION_ROLES: Record<string, UserRole[]> = {
  [`${ProcedureStatus.RECIBIDO}→${ProcedureStatus.EN_REVISION}`]: [
    UserRole.INSPECTOR,
    UserRole.ENCARGADO,
    UserRole.SUPERADMIN,
  ],
  [`${ProcedureStatus.EN_REVISION}→${ProcedureStatus.OBSERVADO_PENDIENTE_RECOJO}`]: [
    UserRole.INSPECTOR,
    UserRole.ENCARGADO,
    UserRole.SUPERADMIN,
  ],
  [`${ProcedureStatus.EN_REVISION}→${ProcedureStatus.CERRADO}`]: [
    UserRole.INSPECTOR,
    UserRole.ENCARGADO,
    UserRole.SUPERADMIN,
  ],
  [`${ProcedureStatus.OBSERVADO_PENDIENTE_RECOJO}→${ProcedureStatus.SUBSANACION_PENDIENTE_REINGRESO}`]: [
    UserRole.SECRETARIA,
    UserRole.ENCARGADO,
    UserRole.SUPERADMIN,
  ],
  // SECRETARIA registers reentry via POST /cycles (autoTransition), NOT via direct PATCH /status
  [`${ProcedureStatus.SUBSANACION_PENDIENTE_REINGRESO}→${ProcedureStatus.EN_REVISION}`]: [
    UserRole.INSPECTOR,
    UserRole.ENCARGADO,
    UserRole.SUPERADMIN,
  ],
};

export const ABANDON_ROLES: UserRole[] = [
  UserRole.SECRETARIA,
  UserRole.INSPECTOR,
  UserRole.ENCARGADO,
  UserRole.SUPERADMIN,
];

export const REACTIVATE_ROLES: UserRole[] = [UserRole.ENCARGADO, UserRole.SUPERADMIN];

// ---------------------------------------------------------------------------
// Subsanation deadline days — not in DeadlineConfig, fixed per procedure type
// Contract Procedures P2 §2.1: RAI=10 days, MAI_PMA=15 days from obsPickedDate
// ---------------------------------------------------------------------------
export const SUBSANATION_DEADLINE_DAYS: Partial<Record<ProcedureTypeCode, number>> = {
  [ProcedureTypeCode.RAI]: 10,
  [ProcedureTypeCode.MAI_PMA]: 15,
};
export const SUBSANATION_DEADLINE_DAYS_DEFAULT = 15;

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------
export const PROCEDURE_MESSAGES = {
  ERROR: {
    NOT_FOUND: 'Procedure not found',
    CASE_FILE_NOT_FOUND: 'Case file not found or inactive',
    CASE_FILE_CLOSED: 'Cannot add procedures to a closed case file',
    PROCEDURE_TYPE_NOT_FOUND: 'Procedure type not found',
    TYPE_NOT_ALLOWED_FOR_CATEGORY: 'Procedure type not allowed for this company category',
    IAA_REQUIRES_MAI_PMA: 'IAA requires at least one closed MAI_PMA in this case file',
    RENOVACION_REQUIRES_CLOSED: 'RENOVACION requires a prior closed procedure of the same type',
    DUPLICATE_ACTIVE_TYPE: 'An active procedure of this type already exists in the case file',
    INVALID_TRANSITION: 'Invalid status transition',
    FORBIDDEN_TRANSITION: 'Your role is not authorized for this status transition',
    ABANDON_REASON_REQUIRED: 'abandonReason is required when abandoning a procedure',
    OBS_PICKED_DATE_REQUIRED: 'obsPickedDate is required for SUBSANACION_PENDIENTE_REINGRESO',
    REVIEW_START_DATE_REQUIRED: 'reviewStartDate is required when transitioning to EN_REVISION',
    APPROVAL_DATE_REQUIRED: 'approvalDate is required when closing a procedure',
    APPROVAL_CERTIFICATE_REQUIRED: 'approvalCertificate is required when closing a procedure',
    EXPIRATION_DATE_REQUIRED: 'expirationDate is required when closing a RAI procedure',
    REQUIRES_ACTIVE_OBSERVATION: 'At least one active observation is required to move to OBSERVADO_PENDIENTE_RECOJO',
    CIERRE_SIMPLIFIED_FLOW: 'CIERRE procedures follow a simplified flow and cannot enter OBSERVADO or SUBSANACION states',
    OBSERVATIONS_NOT_ALLOWED: 'This procedure type does not allow observations',
    REENTRY_NOT_ALLOWED: 'This procedure type does not allow reentry',
    INSPECTOR_NOT_FOUND: 'Inspector user not found or inactive',
    INSPECTOR_INVALID_ROLE: 'User does not have INSPECTOR, ENCARGADO or SUPERADMIN role',
    CANNOT_DELETE_ACTIVE: 'Cannot delete a procedure in an active state (must be CERRADO or ABANDONADO)',
    ALREADY_DELETED: 'Procedure already deleted',
    CYCLE_NOT_FOUND: 'Procedure cycle not found',
    CYCLE_ALREADY_CLOSED: 'Cycle is already closed',
    CYCLE_REQUIRES_SUBSANACION: 'autoTransition requires procedure to be in SUBSANACION_PENDIENTE_REINGRESO',
    OPEN_CYCLE_EXISTS: 'There is already an open cycle for this procedure. Close it before creating a new one.',
    MAX_REENTRIES_EXCEEDED: 'Maximum number of allowed reentries has been reached for this procedure',
  },
  SUCCESS: {
    DELETED: 'Procedure deleted successfully',
    CYCLE_CLOSED: 'Cycle closed successfully',
  },
} as const;

// ---------------------------------------------------------------------------
// Audit actions
// ---------------------------------------------------------------------------
export const PROCEDURE_AUDIT_ACTIONS = {
  CREATED: 'PROCEDURE_CREATED',
  UPDATED: 'PROCEDURE_UPDATED',
  STATUS_CHANGED: 'PROCEDURE_STATUS_CHANGED',
  ASSIGNED: 'PROCEDURE_INSPECTOR_ASSIGNED',
  DELETED: 'PROCEDURE_DELETED',
  CYCLE_CREATED: 'PROCEDURE_CYCLE_CREATED',
  CYCLE_CLOSED: 'PROCEDURE_CYCLE_CLOSED',
} as const;
