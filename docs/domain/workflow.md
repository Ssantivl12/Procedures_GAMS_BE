# Workflow de trámites

## Estados

| Estado | Descripción |
|---|---|
| `RECIBIDO` | Trámite registrado con PDFs adjuntos; el plazo corre desde `receptionDate`. |
| `EN_REVISION` | Inspector analizando el trámite; ciclo activo abierto. |
| `OBSERVADO_PENDIENTE_RECOJO` | Observaciones emitidas; se espera que el contribuyente las recoja. El reloj de plazos está pausado. |
| `SUBSANACION_PENDIENTE_REINGRESO` | Contribuyente recogió observaciones (`obsPickedDate`); corre plazo de subsanación. |
| `CERRADO` | Trámite aprobado con certificado/constancia adjunta. Terminal. |
| `ABANDONADO` | Marcado por inactividad. Pseudo-terminal — reversible solo por ENCARGADO/SUPERADMIN. |

---

## Mapa de transiciones

```
                          ┌─────────────┐
                          │   RECIBIDO  │
                          └──────┬──────┘
                                 │ INSPECTOR / ENCARGADO / SUPERADMIN
                                 ▼
                          ┌─────────────┐
                    ┌────▶│ EN_REVISION │────────────────────────────┐
                    │     └──────┬──────┘                            │
                    │            │ INSPECTOR / ENCARGADO / SUPERADMIN│
                    │            ▼                                   │
                    │  ┌──────────────────────┐                      │
                    │  │ OBSERVADO_PENDIENTE  │                      │
                    │  │      _RECOJO         │                      │
                    │  └──────────┬───────────┘                      │
                    │             │ SECRETARIA / ENCARGADO / SUPERADMIN
                    │             ▼                                   │
                    │  ┌──────────────────────┐                      │
                    │  │  SUBSANACION_        │                      │
                    └──│  PENDIENTE_REINGRESO │                      │
          POST /cycles  └──────────────────────┘                      │
          autoTransition=true                                         │
                                                                      ▼
                                                               ┌──────────┐
                                                               │ CERRADO  │
                                                               └──────────┘

  Cualquier estado activo ──▶ ABANDONADO (reversible: restaura estado anterior)
```

Estados activos (pueden ir a ABANDONADO): `RECIBIDO`, `EN_REVISION`, `OBSERVADO_PENDIENTE_RECOJO`, `SUBSANACION_PENDIENTE_REINGRESO`.

---

## Detalle de cada transición

### `RECIBIDO → EN_REVISION`
- **Roles**: INSPECTOR, ENCARGADO, SUPERADMIN
- **Body**: `{ "toStatus": "EN_REVISION", "reviewStartDate"?: "YYYY-MM-DD" }`
  - `reviewStartDate` es opcional (metadata); el plazo ya corre desde `receptionDate`.
- **Efecto**: crea `ProcedureCycle` #1 e incrementa `cycleCount`.

### `EN_REVISION → OBSERVADO_PENDIENTE_RECOJO`
- **Roles**: INSPECTOR, ENCARGADO, SUPERADMIN
- **Body**: `{ "toStatus": "OBSERVADO_PENDIENTE_RECOJO" }`
- **Precondición**: debe existir al menos 1 observación activa (`isResolved: false`) en el trámite; si no, la API devuelve 422.
- **Efecto**: cierra el ciclo activo automáticamente.

### `EN_REVISION → CERRADO`
- **Roles**: INSPECTOR, ENCARGADO, SUPERADMIN
- **Body**:
  ```json
  {
    "toStatus": "CERRADO",
    "approvalDate": "YYYY-MM-DD",
    "approvalCertificate": "N-RAI-XXXX",
    "expirationDate": "YYYY-MM-DD"   // solo requerido si type = RAI
  }
  ```
- **Precondición**: no puede haber observaciones pendientes sin resolver; si las hay, devuelve 422.
- **Efecto**: cierra ciclo activo; si el tipo es RAI, sincroniza `approvalCertificate` → `Company.raiNumber`.

### `OBSERVADO_PENDIENTE_RECOJO → SUBSANACION_PENDIENTE_REINGRESO`
- **Roles**: SECRETARIA, ENCARGADO, SUPERADMIN
- **Body**: `{ "toStatus": "SUBSANACION_PENDIENTE_REINGRESO", "obsPickedDate": "YYYY-MM-DD" }`
  - `obsPickedDate` es obligatorio; desde aquí corre el plazo de subsanación.
- **Efecto**: calcula y guarda el nuevo `deadlineDate`; cierra el ciclo activo.

### `SUBSANACION_PENDIENTE_REINGRESO → EN_REVISION`
> **CRÍTICO**: esta transición NO se puede ejecutar con `PATCH /procedures/:id/status`.  
> Intentarlo devuelve 422 con `REENTRY_MUST_USE_CYCLES_ENDPOINT`.

Usar: `POST /procedures/:id/cycles` con `autoTransition: true`.

- **Body**:
  ```json
  {
    "reentryDate": "YYYY-MM-DD",
    "reviewStartDate": "YYYY-MM-DD",  // opcional; defaults a reentryDate
    "autoTransition": true,
    "note"?: "string"
  }
  ```
- **Efecto**: crea nuevo `ProcedureCycle`, incrementa `cycleCount` y `reentryCount`, actualiza `deadlineDate` con el plazo de reingreso, transiciona el estado a `EN_REVISION`.

### `* → ABANDONADO`
- **Roles**: SECRETARIA, INSPECTOR, ENCARGADO, SUPERADMIN
- **Body**: `{ "toStatus": "ABANDONADO", "abandonReason": "string" }`
  - `abandonReason` es obligatorio.
- **Efecto**: cierra ciclos activos; guarda el estado anterior en `ProcedureAudit`.

### `ABANDONADO → estado anterior`
- **Roles**: solo ENCARGADO y SUPERADMIN
- **Body**: `{ "toStatus": "<cualquier estado>" }` — el valor de `toStatus` en el body es ignorado; el sistema recupera el estado previo del último registro de `ProcedureAudit` donde `toStatus = ABANDONADO`.
- **Efecto**: restaura exactamente el estado previo al abandono.

---

## Reglas especiales (no obvias)

1. **CIERRE no pasa por OBSERVADO ni SUBSANACION.** El `ProcedureType` CIERRE tiene `allowsObservations: false` y `allowsReentry: false`. Intentar esas transiciones devuelve 422.

2. **Cerrar RAI sincroniza el N° RAI.** Al cerrar un trámite de tipo RAI, el campo `approvalCertificate` se copia automáticamente a `Company.raiNumber`.

3. **Solo un ciclo abierto a la vez.** Si ya existe un `ProcedureCycle` con `closedAt: null`, intentar crear otro (ya sea por `RECIBIDO→EN_REVISION` o por `POST /cycles`) devuelve 409.

4. **El reloj de plazos depende del estado y el ciclo:**
   - `RECIBIDO` y primer `EN_REVISION` (`cycleCount ≤ 1`): reloj desde `receptionDate`.
   - `EN_REVISION` de reingreso (`cycleCount > 1`): reloj desde `reviewStartDate`.
   - `SUBSANACION_PENDIENTE_REINGRESO`: reloj desde `obsPickedDate`.
   - `OBSERVADO_PENDIENTE_RECOJO`: reloj pausado (sin `clockStartDate`).

---

## Ciclos (`ProcedureCycle`)

Un ciclo representa una ronda completa de revisión.

**Se crean en:**
- `RECIBIDO → EN_REVISION` (vía `PATCH /status`): crea ciclo #1 automáticamente.
- `POST /procedures/:id/cycles` con `autoTransition: true`: crea ciclo #N para reingresos.

**Se cierran automáticamente cuando el trámite llega a:**
`OBSERVADO_PENDIENTE_RECOJO`, `SUBSANACION_PENDIENTE_REINGRESO`, `CERRADO`, `ABANDONADO`.

**Campos clave del ciclo:**

| Campo | Descripción |
|---|---|
| `cycleNumber` | Número secuencial dentro del trámite (1, 2, 3…). |
| `reentryDate` | Fecha de reingreso (null en el ciclo #1). |
| `reviewDeadline` | Fecha límite de revisión calculada con días hábiles. |
| `closedAt` | Fecha de cierre; `null` = ciclo abierto. |
