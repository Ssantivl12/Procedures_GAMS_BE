export const USER_MESSAGES = {
  ERROR: {
    NOT_FOUND: 'User not found',
    EMAIL_ALREADY_EXISTS: 'Email is already registered',
    EMAIL_IN_USE: 'Email is already in use by another user',
    INVALID_ROLES: 'One or more selected roles are invalid',
    CANNOT_DELETE_SELF: 'You cannot delete your own account',
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
    FIRSTNAME_STRING: 'First name must be a string',
    FIRSTNAME_REQUIRED: 'First name is required',
    LASTNAME_STRING: 'Last name must be a string',
    LASTNAME_REQUIRED: 'Last name is required',
    ROLES_ARRAY: 'Roles must be an array',
    ROLES_KEY_ENUM: 'One or more roles are invalid',
    ROLES_REQUIRED: 'Roles are required',
    IS_ACTIVE_BOOLEAN: 'isActive must be a boolean',
  },
} as const;
