export const OBSERVATION_MESSAGES = {
  ERROR: {
    NOT_FOUND: 'Observation not found',
    PROCEDURE_NOT_FOUND: 'Procedure not found or inactive',
    CYCLE_NOT_FOUND: 'Cycle not found',
    CYCLE_NOT_OPEN: 'Cannot create observations on a closed cycle',
    PROCEDURE_NOT_IN_REVISION:
      'Observations can only be created when the procedure is in EN_REVISION',
    ALREADY_RESOLVED: 'Cannot modify a resolved observation; reopen it first',
    NOT_RESOLVED: 'Observation is not resolved',
    DELETE_PENDING: 'Cannot delete a pending (unresolved) observation',
    ALREADY_DELETED: 'Observation already deleted',
  },
  SUCCESS: {
    DELETED: 'Observation deleted successfully',
  },
} as const;

export const OBSERVATION_AUDIT_ACTIONS = {
  CREATED: 'OBSERVATION_CREATED',
  UPDATED: 'OBSERVATION_UPDATED',
  RESOLVED: 'OBSERVATION_RESOLVED',
  REOPENED: 'OBSERVATION_REOPENED',
  DELETED: 'OBSERVATION_DELETED',
} as const;
