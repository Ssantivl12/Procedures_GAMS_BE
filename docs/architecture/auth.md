# Autenticación — Tokens y pipeline

## Visión general

El sistema usa **JWT stateless para el access token** y **refresh tokens con estado en BD** para sesiones de larga duración. No hay sesiones en servidor; cada request es autenticado verificando la firma del JWT.

---

## Tokens

### Access token

| Campo | Valor |
|---|---|
| Algoritmo | HS256 (HMAC + `JWT_SECRET`) |
| Expiración | `JWT_EXPIRES_IN` (default `1h`) |
| Payload | `sub`, `email`, `roles[]`, `firstName`, `lastName`, `isActive` |
| Transporte | Header `Authorization: Bearer <token>` |

Los roles van embebidos en el payload: **`JwtStrategy.validate()` no hace ninguna query a BD**. Si se cambia el rol de un usuario, el cambio no es efectivo hasta que el access token actual expire y el cliente haga refresh.

### Refresh token

| Campo | Valor |
|---|---|
| Expiración | `REFRESH_TOKEN_EXPIRES_IN` (default `7d`) |
| Almacenamiento | BD tabla `refresh_token`, guardado como **SHA-256 hash** del token raw |
| Payload JWT | `sub` + `jti` (UUID único por sesión) |
| Rotación | Obligatoria — cada uso revoca el token anterior y emite uno nuevo |

El token raw nunca se persiste; solo su hash. Si la BD es comprometida, los tokens en texto plano no están expuestos.

---

## Flujo de login

```
Cliente                          Servidor
  │                                  │
  ├─ POST /auth/login ──────────────▶│
  │  { email, password }             │
  │                                  ├─ bcrypt.compare(password, hash)
  │                                  │  [dummy compare si email no existe → timing-safe]
  │                                  ├─ signAsync(payload)  → accessToken
  │                                  ├─ signAsync({sub,jti}) → refreshToken
  │                                  ├─ BD: INSERT refresh_token (hash del token)
  │                                  ├─ BD: UPDATE user.lastLoginAt
  │                                  ├─ auditService.logCritical(LOGIN_SUCCESS)
  │◀─ 200 { accessToken, ──────────────┤
  │         refreshToken, user }     │
```

Si el email no existe, el servidor corre `bcrypt.compare` contra un hash pre-computado (`TIMING_DUMMY_HASH`) para que el tiempo de respuesta sea indistinguible de un email válido con contraseña incorrecta.

---

## Flujo de refresh (rotación)

```
Cliente                          Servidor
  │                                  │
  ├─ POST /auth/refresh ────────────▶│
  │  { refreshToken }                │
  │                                  ├─ jwtService.verifyAsync(token)  ← falla rápido si inválido
  │                                  ├─ BD: SELECT WHERE token = SHA256(refreshToken)
  │                                  ├─ Validar: !revoked && expiresAt > now && user.isActive
  │                                  ├─ BD: UPDATE token SET revoked=true   ← revoca anterior
  │                                  ├─ BD: INSERT nuevo refresh_token
  │                                  ├─ signAsync(nuevo payload con roles frescos)
  │◀─ 200 { accessToken, ──────────────┤
  │         refreshToken }           │
```

En el refresh, los roles se leen de BD frescos (a diferencia del access token que los lleva en payload). Esto significa que un cambio de rol es efectivo en el próximo refresh.

---

## Pipeline de autenticación por request

Todos los endpoints (excepto `/auth/login` y `/auth/refresh`) pasan por dos guards en orden:

```
Request HTTP
    │
    ▼
JwtAuthGuard (passport-jwt)
    ├─ Extrae Bearer token del header Authorization
    ├─ Verifica firma con JWT_SECRET
    ├─ Verifica expiración
    ├─ Llama JwtStrategy.validate(payload) → adjunta user al request
    │   [NO hace query a BD]
    └─ Si falla → 401 Unauthorized
    │
    ▼
RolesGuard
    ├─ Lee metadata @Roles(...) del handler o la clase (via Reflector)
    ├─ Si no hay @Roles → permite (endpoint público autenticado)
    ├─ Comprueba que user.roles incluya al menos uno de los roles requeridos
    └─ Si falla → 403 Forbidden
    │
    ▼
Controller handler
```

Los guards se aplican **siempre en el controller**, nunca en el service. El service puede asumir que el usuario está autenticado y autorizado.

### Rate limiting

Los endpoints sensibles tienen throttling adicional via `@Throttle`:

| Endpoint | Límite |
|---|---|
| `POST /auth/login` | 5 intentos / 15 minutos |
| `POST /auth/change-password` | 3 intentos / 1 hora |

Los límites se configuran en `AUTH.RATE_LIMIT` (`src/common/constants/auth.constants.ts`).

---

## Logout

- **Con `refreshToken` en body**: revoca solo esa sesión (ese dispositivo).
- **Sin `refreshToken`**: revoca todos los refresh tokens activos del usuario (logout de todos los dispositivos).

El access token no se puede invalidar activamente (es stateless). Expira solo según `JWT_EXPIRES_IN`. Para flujos de seguridad críticos (baja de usuario), se desactiva el usuario con `isActive=false`; la validación en `JwtStrategy` no rechaza el token, pero `RolesGuard` o cualquier guard subsecuente puede hacerlo si verifica `isActive`.

---

## Cambio de contraseña

Al cambiar la contraseña:
1. Valida que `currentPassword` coincide con el hash en BD.
2. Valida que `newPassword !== currentPassword`.
3. Hashea la nueva contraseña con bcrypt (12 rounds).
4. **Revoca todos los refresh tokens activos** del usuario — fuerza re-login en todos los dispositivos.
5. `auditService.logCritical(PASSWORD_CHANGE)` — awaited, no fire-and-forget.

---

## Scheduler — purga de tokens (02:00 AM)

`AuthSchedulerService` corre un cron diario a las 02:00 AM (offset de 2h respecto al scheduler de procedimientos que corre a las 00:05):

```ts
// Elimina físicamente tokens expirados O revocados
DELETE FROM refresh_token WHERE expiresAt < NOW() OR revoked = true
```

Mantiene la tabla `refresh_token` pequeña. No afecta la autenticación activa.

---

## Audit trail de autenticación

Todos los eventos de auth usan `auditService.logCritical()` (awaited, propaga errores):

| Acción | Cuándo |
|---|---|
| `LOGIN_SUCCESS` | Login correcto |
| `LOGIN_FAILED` | Credenciales inválidas (registra IP y user-agent) |
| `LOGOUT` | Logout explícito |
| `REFRESH_TOKEN` | Rotación de refresh token |
| `PASSWORD_CHANGE` | Cambio de contraseña |
| `USER_CREATED` | SuperAdmin crea usuario |
| `ROLE_ASSIGNED` | Rol asignado a usuario |
| `ROLE_REVOKED` | Rol revocado |
