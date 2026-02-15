export const USER_MESSAGES = {
  ERROR: {
    NOT_FOUND: 'User not found',
    EMAIL_ALREADY_EXISTS: 'Email is already registered',
    EMAIL_IN_USE: 'Email is already in use by another user',
    INVALID_ROLES: 'One or more selected roles are invalid',
  },
  SUCCESS: {
    USER_DELETED: 'User deleted successfully',
  },
  VALIDATION: {
    EMAIL_INVALID: 'Email is invalid',
    EMAIL_REQUIRED: 'Email is required',
    PASSWORD_STRING: 'Password must be a string',
    PASSWORD_REQUIRED: 'Password is required',
    PASSWORD_MIN_LENGTH: 'Password must be at least 8 characters long',
    FULLNAME_STRING: 'Full name must be a string',
    FULLNAME_REQUIRED: 'Full name is required',
    ROLES_ARRAY: 'Roles must be an array',
    ROLES_KEY_ENUM: 'One or more roles are invalid',
    ROLES_REQUIRED: 'Roles are required',
    IS_ACTIVE_BOOLEAN: 'isActive must be a boolean',
  },
} as const;
