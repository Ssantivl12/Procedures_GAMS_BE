export const AUTH = {
  PASSWORD: {
    MIN_LENGTH: 8,
    MAX_LENGTH: 50,
    BCRYPT_ROUNDS: 12,
  },
  RATE_LIMIT: {
    LOGIN: { ttl: 15 * 60, limit: 5 },      // 5 intentos / 15 min
    PASSWORD: { ttl: 60 * 60, limit: 3 },   // 3 intentos / 1 hora
  },
  AUDIT_ACTIONS: {
    LOGIN_SUCCESS: 'LOGIN_SUCCESS',
    LOGIN_FAILED: 'LOGIN_FAILED',
    LOGOUT: 'LOGOUT',
    REFRESH_TOKEN: 'REFRESH_TOKEN',
    PASSWORD_CHANGE: 'PASSWORD_CHANGE',
    
    // solo SUPERADMIN
    USER_CREATED: 'USER_CREATED',
    ROLE_ASSIGNED: 'ROLE_ASSIGNED',
    ROLE_REVOKED: 'ROLE_REVOKED',
  },
} as const;