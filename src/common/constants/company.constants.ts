export const COMPANY_MESSAGES = {
  ERROR: {
    RAI_EXISTS: 'RAI number already exists',
    NIT_EXISTS: 'NIT already registered for another company',
    NOT_FOUND: 'Company not found',
    HAS_ACTIVE_CASE_FILE: 'Cannot delete company with active case file',
    ALREADY_DELETED: 'Company already deleted',
    CATEGORY_REQUIRED: 'category should not be empty',
    FORBIDDEN_INACTIVE: 'Only SUPERADMIN can view inactive companies',
    ALREADY_ACTIVE: 'Company is already active',
  },
  SUCCESS: {
    DELETED: 'Company deleted successfully',
    REACTIVATED: 'Company reactivated successfully',
  },
} as const;

export const COMPANY_DEFAULTS = {
  MUNICIPALITY: 'Sacaba',
} as const;

export const COMPANY_AUDIT_ACTIONS = {
  CREATED: 'COMPANY_CREATED',
  UPDATED: 'COMPANY_UPDATED',
  DELETED: 'COMPANY_DELETED',
  REACTIVATED: 'COMPANY_REACTIVATED',
} as const;