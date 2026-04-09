# Procedures_GAMS_BE

Backend interno para digitalizar expedientes IRAPS y seguimiento de trámites ambientales (GAMS).

## Stack

- **Runtime**: Node.js v20 · **Package manager**: pnpm
- **Framework**: NestJS 11 · **ORM**: Prisma · **DB**: PostgreSQL
- **Auth**: JWT (access + refresh tokens) · **Scheduler**: `@nestjs/schedule`

## Commands

```bash
pnpm start:dev          # dev with watch
pnpm build              # compile to dist/
pnpm start:prod         # run compiled build
pnpm prisma:migrate     # run pending migrations (dev)
pnpm prisma:generate    # regenerate Prisma client
pnpm prisma:seed        # seed DB (ts-node prisma/seed.ts)
pnpm test               # unit tests
pnpm test:e2e           # e2e tests
```

## Conventions

- **Module structure**: `controller → service → PrismaService` directly. No repository layer.
- **Guards always on controllers**, never in services. Auth guard + roles guard applied per-route.
- **Error messages** in `src/common/constants/*.constants.ts` (e.g. `PROCEDURE_MESSAGES.ERROR`). Never hardcode strings in services.
- **Audit actions** also in constants (`PROCEDURE_AUDIT_ACTIONS`). All state changes must emit an audit log.
- **Workflow transitions** enforced via `TRANSITIONS_MAP` and `TRANSITION_ROLES` in `procedure.constants.ts`. Adding a new transition requires updating both maps.
- **Dates**: stored as `@db.Date` (no time component) for business dates; `@db.Timestamptz(6)` for audit timestamps.
- **Soft deletes**: `isActive + deletedAt` pattern on all main entities.

## Domain

See [`docs/`](docs/) for domain knowledge: workflows, deadlines, category rules, architecture.
