export const COMPANY_MESSAGES = {
  ERROR: {
    RAI_EXISTS: 'RAI number already exists',
    NOT_FOUND: 'Company not found',
    HAS_ACTIVE_CASE_FILE: 'Cannot delete company with active case file',
    ALREADY_DELETED: 'Company already deleted',
    CATEGORY_REQUIRED: 'category should not be empty',
    FORBIDDEN_INACTIVE: 'Only SUPERADMIN can view inactive companies',
  },
  SUCCESS: {
    DELETED: 'Company deleted successfully',
  },
} as const;

export const COMPANY_DEFAULTS = {
  MUNICIPALITY: 'Sacaba',
} as const;

export const COMPANY_AUDIT_ACTIONS = {
  CREATED: 'COMPANY_CREATED',
  UPDATED: 'COMPANY_UPDATED',
  DELETED: 'COMPANY_DELETED',
} as const;