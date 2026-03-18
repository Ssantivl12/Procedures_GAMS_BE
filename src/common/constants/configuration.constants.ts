export const CONFIG_MESSAGES = {
  DEADLINE: {
    ERROR: {
      NOT_FOUND: 'Deadline configuration not found or inactive',
      DUPLICATE: 'A deadline config for this procedureType and cycleNumber already exists',
      INACTIVE: 'Cannot deactivate: deadline config is already inactive',
    },
    SUCCESS: {
      DEACTIVATED: 'Deadline configuration deactivated',
    },
  },
  NON_WORKING_DAY: {
    ERROR: {
      NOT_FOUND: 'Non-working day not found or inactive',
      DUPLICATE: 'A non-working day for this date already exists',
      INACTIVE: 'Cannot deactivate: non-working day is already inactive',
    },
    SUCCESS: {
      DEACTIVATED: 'Non-working day deactivated',
    },
  },
  PROCEDURE_TYPE: {
    ERROR: {
      NOT_FOUND: 'Procedure type not found',
    },
  },
} as const;
