# Documentación — Procedures GAMS BE

Índice de toda la documentación del proyecto. Empezar aquí.

---

## Dominio

> Entender el problema antes de tocar código.

| Archivo | Cuándo leerlo |
|---|---|
| [domain/overview.md](domain/overview.md) | Primera vez que trabajas en el proyecto. Qué es IRAPS, categorías C3/C4, jerarquía de entidades, roles. |
| [domain/workflow.md](domain/workflow.md) | Antes de tocar transiciones de estado, ciclos o cualquier lógica de trámites. Estados, quién puede hacer qué, reglas no obvias. |
| [domain/deadlines.md](domain/deadlines.md) | Antes de tocar plazos, el scheduler, `buildResponse` o `ConfigCacheService`. Explica por qué `deadlineDate` en BD puede diferir de la respuesta. |
| [domain/categories-rules.md](domain/categories-rules.md) | Reglas de negocio C3 vs C4: dependencias RAI → MAI-PMA → IAA. |

---

## Arquitectura

> Cómo está construido el sistema.

| Archivo | Cuándo leerlo |
|---|---|
| [architecture/overview.md](architecture/overview.md) | Módulos NestJS, patrón controller→service→Prisma (sin repo layer), sistema de trazabilidad (AuditLog + EntitySnapshot), CorrelationId, ValidationPipe y env vars. |
| [architecture/auth.md](architecture/auth.md) | Pipeline completo de autenticación: JWT, refresh tokens, rotación, guards, rate limiting, scheduler de purga. |
| [architecture/roles.md](architecture/roles.md) | Matriz de permisos por rol y módulo. Implementación de `JwtAuthGuard` + `RolesGuard`. |
| [architecture/scheduler.md](architecture/scheduler.md) | Para entender el job nocturno (00:05) que persiste `daysElapsed` e `isOverdue` en BD. |
| [architecture/storage.md](architecture/storage.md) | Para entender cómo se almacenan los PDFs en disco y cómo funciona `StorageService`. |

---

## API

> Contratos de los endpoints. Formato OpenAPI 3.0.

| Archivo | Módulo / Rutas |
|---|---|
| [api/auth.yaml](api/auth.yaml) | `POST /auth/login`, `/refresh`, `/logout`, `/change-password` |
| [api/users.yaml](api/users.yaml) | `GET|POST /users`, `/users/me`, `/users/inspectors`, `/users/:id` |
| [api/companies.yaml](api/companies.yaml) | `GET|POST /companies`, `/companies/:id`, `/companies/:id/case-file`, `/reactivate` |
| [api/cases.yaml](api/cases.yaml) | `GET|POST /case-files`, `/case-files/:id`, `/close`, `/reopen`, `/case-files/:id/procedures` |
| [api/procedures.yaml](api/procedures.yaml) | `GET|POST /procedures`, `/procedures/:id`, `/status`, `/assign`, `/audit`, `/cycles` |
| [api/observations.yaml](api/observations.yaml) | `GET|POST /procedures/:id/observations`, `/resolve`, `/reopen`, `/cycles/:id/observations` |
| [api/documents.yaml](api/documents.yaml) | `GET|POST /procedures/:id/documents`, `/download`, `/versions` |
| [api/configuration.yaml](api/configuration.yaml) | `GET|PATCH /config/procedure-types`, `GET|POST|PATCH|DELETE /config/deadlines`, `/config/non-working-days` |
| [api/reports.yaml](api/reports.yaml) | `GET /dashboard`, `/alerts/*`, `/reports/*` |

---

## Operaciones

| Archivo | Cuándo leerlo |
|---|---|
| [ops/deployment.md](ops/deployment.md) | Setup inicial, credenciales del seed, deploy a producción (PM2 + Nginx). |
| [ops/env-vars.md](ops/env-vars.md) | Referencia completa de variables de entorno con defaults. |

---

## Guía rápida por tarea

| Quiero... | Leer primero |
|---|---|
| Agregar un nuevo estado al workflow | [domain/workflow.md](domain/workflow.md) → `procedure.constants.ts` `TRANSITIONS_MAP` |
| Cambiar un plazo por tipo de trámite | [domain/deadlines.md](domain/deadlines.md) → `PATCH /config/deadlines/:id` |
| Agregar un endpoint nuevo | [architecture/overview.md](architecture/overview.md) → módulo correspondiente en `src/` |
| Entender por qué un trámite aparece vencido en la BD pero no en la respuesta | [domain/deadlines.md](domain/deadlines.md) sección "buildResponse vs scheduler" |
| Agregar un feriado | `POST /config/non-working-days` — el caché se invalida solo |
| Entender una transición que devuelve 422 | [domain/workflow.md](domain/workflow.md) sección "Reglas especiales" |
| Ver el historial completo de un trámite u observación | [architecture/overview.md](architecture/overview.md) sección "Trazabilidad" — tablas `audit_log` y `entity_snapshot` |
| Reconstruir el estado de un trámite en una fecha pasada | [architecture/overview.md](architecture/overview.md) sección "Trazabilidad" — consulta de snapshot por fecha |
| Saber qué rol puede hacer X acción | [architecture/roles.md](architecture/roles.md) |
| Entender por qué el token sigue válido tras cambiar el rol | [architecture/auth.md](architecture/auth.md) sección "Pipeline" |
