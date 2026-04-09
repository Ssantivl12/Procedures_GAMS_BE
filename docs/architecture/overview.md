# Arquitectura — Visión general

## Módulos NestJS

| Módulo | Responsabilidad |
|---|---|
| `AuthModule` | Login/logout, emisión y rotación de JWT access + refresh tokens, throttling de endpoints sensibles. |
| `UsersModule` | CRUD de usuarios internos y gestión de roles. Solo accesible por SUPERADMIN. |
| `AuditModule` | Escritura de `AuditLog` en BD. Expone `AuditService` (ver sección de trazabilidad). |
| `SnapshotModule` | Escritura de `EntitySnapshot` en BD. Expone `SnapshotService` (ver sección de trazabilidad). |
| `CompaniesModule` | CRUD de empresas (C3/C4) y consulta de su expediente vinculado. |
| `CasesModule` | Gestión del expediente (`CaseFile`): creación, apertura/cierre, búsqueda por empresa. |
| `ProceduresModule` | Núcleo del dominio: trámites, transiciones de estado, ciclos, asignación de inspector, scheduler nocturno. |
| `ObservationsModule` | Creación y resolución de observaciones vinculadas a un trámite/ciclo. |
| `DocumentsModule` | Subida, descarga y versionado de PDFs en disco. Expone `StorageService`. |
| `ConfigurationModule` | Gestión de `DeadlineConfig` y `NonWorkingDay`; invalida el caché en memoria tras cada mutación. Expone `ConfigCacheService`. |
| `ReportsModule` | Generación de listados y métricas (solo lectura); usa datos ya calculados por el scheduler. |
| `DbModule` | Provee `PrismaService` como singleton global con pool de conexiones pg. |

---

## Patrón uniforme de módulos

Todos los módulos siguen exactamente la misma estructura. No hay repository layer.

```
Controller  ──▶  Service  ──▶  PrismaService (directo)
```

`PrismaService` se inyecta directamente en cada service. Esta decisión es **intencional**: el esquema Prisma ya actúa como la capa de abstracción sobre la BD y agregar repositorios solo sumaría indirección sin beneficio en este tipo de aplicación. No introducir un repository pattern a menos que haya un motivo explícito.

---

## Trazabilidad (Audit & Snapshots)

El sistema tiene tres capas de trazabilidad complementarias:

| Capa | Tabla | Cuándo usar |
|---|---|---|
| `ProcedureAudit` | `procedure_audit` | Transiciones de estado: `fromStatus → toStatus`, quién, cuándo, nota. Inmutable. |
| `AuditLog` | `audit_log` | Log de acciones: quién hizo qué operación y sobre qué entidad. Fire-and-forget. |
| `EntitySnapshot` | `entity_snapshot` | Foto completa del estado de una entidad en cada mutación. Permite reconstrucción histórica. |

### AuditService

Expone dos métodos con semánticas distintas:

**`log()` — fire-and-forget** (usar para eventos operacionales)

```ts
this.auditService.log({
  action: PROCEDURE_AUDIT_ACTIONS.STATUS_CHANGED,
  userId,
  entityType: 'PROCEDURE',   // filtra por entidad en audit_log
  entityId: procedure.id,
  details: { fromStatus, toStatus },
});
```

- No bloqueante. Si falla la escritura, el error se logea en consola pero **no propaga**.
- `entityType` y `entityId` son opcionales pero deben pasarse siempre para habilitar la consulta `WHERE entity_type = 'X' AND entity_id = '...'`.

**`logCritical()` — awaited** (usar para eventos de seguridad)

```ts
await this.auditService.logCritical({ action: AUTH_AUDIT_ACTIONS.LOGIN, userId, details });
```

- Bloqueante. Si falla, el error **sí propaga** al caller.
- Usar cuando perder el log sería inaceptable: login, logout, cambio de contraseña.

### SnapshotService

```ts
this.snapshot.save({
  entityType: 'PROCEDURE',
  entityId: id,
  action: PROCEDURE_AUDIT_ACTIONS.UPDATED,
  changedById: userId,
  snapshotData: { before: { ... }, after: { ... } },  // o solo { ...estado }
});
```

- Fire-and-forget. Nunca bloquea el request principal.
- `snapshotData` contiene **solo campos escalares** de la entidad (sin relaciones).
- Para `UPDATED`, `STATUS_CHANGED`, `RESOLVED`, `REOPENED`: `{ before, after }` — permite ver exactamente qué cambió.
- Para `CREATED`, `DELETED`, `ASSIGNED`: estado completo en el momento del evento.

### Qué cubre cada operación

| Operación | AuditLog | EntitySnapshot |
|---|---|---|
| Crear trámite | `PROCEDURE_CREATED` | Estado inicial completo |
| Editar trámite | `PROCEDURE_UPDATED` | `{ before, after }` de campos escalares |
| Cambio de estado | `PROCEDURE_STATUS_CHANGED` | `{ before, after }` de campos escalares |
| Asignar inspector | `PROCEDURE_INSPECTOR_ASSIGNED` | `{ previousInspectorUserId, newInspectorUserId }` |
| Eliminar trámite (soft) | `PROCEDURE_DELETED` | Estado final antes de soft delete |
| Crear observación | `OBSERVATION_CREATED` | Estado inicial completo |
| Editar observación | `OBSERVATION_UPDATED` | `{ before, after }` |
| Resolver observación | `OBSERVATION_RESOLVED` | `{ before, after }` |
| Reabrir observación | `OBSERVATION_REOPENED` | `{ before, after }` |
| Eliminar observación (soft) | `OBSERVATION_DELETED` | Estado final antes de soft delete |

### Consultas típicas

```sql
-- Todo lo que le pasó a un trámite
SELECT * FROM audit_log
WHERE entity_type = 'PROCEDURE' AND entity_id = '<uuid>'
ORDER BY created_at;

-- Estado de un trámite en una fecha específica
SELECT snapshot_data FROM entity_snapshot
WHERE entity_type = 'PROCEDURE' AND entity_id = '<uuid>'
  AND changed_at <= '<fecha>'
ORDER BY changed_at DESC LIMIT 1;

-- Comparar antes/después de una edición
SELECT snapshot_data->'before', snapshot_data->'after'
FROM entity_snapshot
WHERE entity_type = 'PROCEDURE' AND entity_id = '<uuid>'
  AND action = 'PROCEDURE_UPDATED';
```

---

## CorrelationId y logger estructurado

Cada request HTTP pasa por `CorrelationIdMiddleware` (aplicado globalmente en `AppModule`):

1. Lee el header `X-Correlation-ID` del request entrante; si no existe, genera un UUID v4.
2. Devuelve el mismo valor en el header de respuesta `X-Correlation-ID`.
3. Almacena el ID en `AsyncLocalStorage` (`requestContext`) para que esté disponible en cualquier punto de la cadena de llamadas sin necesidad de pasarlo como parámetro.

`JsonLoggerService` (logger global registrado en `NestFactory.create`) lee el ID de `requestContext.getStore()` en cada línea de log y lo incluye en el JSON de salida:

```json
{
  "timestamp": "2025-04-09T12:00:00.000Z",
  "level": "log",
  "context": "ProceduresService",
  "message": "...",
  "correlationId": "b3f1a2d4-..."
}
```

Todos los logs van a `stdout` como JSON, uno por línea, listos para ingestión por cualquier agregador (journald, Loki, etc.).

---

## Validación global

`ValidationPipe` está registrado globalmente en `main.ts` con dos opciones clave:

- **`transform: true`**: convierte automáticamente los valores del body/query al tipo declarado en el DTO (e.g., strings `"true"` → booleanos, strings de fecha → objetos `Date` cuando se usa `@Type`). Los DTOs de query con parámetros numéricos (`page`, `limit`) dependen de esto.
- **`whitelist: true`**: elimina silenciosamente cualquier propiedad que no esté declarada en el DTO antes de que llegue al service. Nunca llegan campos extra al service; no hay necesidad de filtrar manualmente.

---

## Variables de entorno

Validadas con Joi en `AppModule` al arrancar. El proceso falla con error descriptivo si faltan las requeridas.

| Variable | Requerida | Default |
|---|---|---|
| `DATABASE_URL` | Sí | — |
| `JWT_SECRET` | Sí (mín. 32 chars) | — |
| `JWT_EXPIRES_IN` | No | `1h` |
| `REFRESH_TOKEN_EXPIRES_IN` | No | `7d` |
| `FRONTEND_URL` | No | `http://localhost:5173` |
| `UPLOAD_MAX_SIZE_MB` | No | `20` |
| `UPLOAD_ALLOWED_TYPES` | No | `application/pdf` |
| `PORT` | No | `3000` |
| `NODE_ENV` | No | — (afecta nivel de log de Prisma) |

`NODE_ENV=development` activa el log de queries SQL de Prisma (`['query','info','warn','error']`); en cualquier otro valor solo loguea errores.
