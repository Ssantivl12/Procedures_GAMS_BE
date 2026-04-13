# Sistema de plazos y días hábiles

## Dos relojes independientes

Los plazos operan sobre dos actores distintos y **nunca se mezclan**:

| Reloj | Campo en BD | Quién lo mide | Origen del valor |
|---|---|---|---|
| **Plazo del personal** | `deadlineDate` | El técnico revisor | `DeadlineConfig` o regla de dominio fija |
| **Plazo de subsanación** | `subsanacionDeadlineDate` | La empresa | Ingresado manualmente por el personal al registrar el recojo |

El plazo de subsanación **no** viene de configuración y **no** es recalculable: lo determina el técnico al momento de transicionar a `SUBSANACION_PENDIENTE_REINGRESO` enviando `subsanacionDays` (días hábiles).

---

## Plazos del personal: reglas de dominio fijas vs. configuración

`getDeadlineDays(typeCode, cycleCount, companyStatus)` resuelve el plazo en este orden de precedencia:

### 1. Reglas de dominio fijas (no configurables, hardcodeadas en `procedure.constants.ts`)

| Tipo | companyStatus | Ciclo | Días |
|---|---|---|---|
| RAI | PROYECTO | todos | **5** (`RAI_PROYECTO_FIXED_DAYS`) |
| MAI_PMA | PROYECTO | primer ciclo (`cycleCount = 0`) | **15** (`MAI_PMA_PROYECTO_FIRST_DAYS`) |
| MAI_PMA | PROYECTO | reingresos (`cycleCount >= 1`) | **10** (`MAI_PMA_PROYECTO_REINGRESO_DAYS`) |

Estas reglas interceptan la consulta al cache antes de llegar a `DeadlineConfig`. El administrador **no puede sobrescribirlas** desde el panel de configuración.

### 2. DeadlineConfig (configurable por el administrador)

Aplica para todos los demás casos. Usa solo dos `cycleNumber`: `0` (primera revisión) y `1` (reingresos). Cualquier `cycleCount >= 1` en el trámite se mapea a la clave de configuración `1`.

| Tipo | cycleNumber 0 (primera revisión) | cycleNumber 1 (reingresos) |
|---|---|---|
| RAI | **10** días hábiles | **10** días hábiles |
| MAI_PMA | **15** días hábiles | **15** días hábiles |
| IAA | **10** días hábiles | **10** días hábiles |
| CIERRE | **10** días hábiles | — (sin reingreso) |

> Los valores anteriores de RAI cycleNumber=0 eran 5 días. Actualizado a 10 porque ese registro ahora
> aplica solo a casos no-PROYECTO, que deben tener 10 días.

---

## clockStartDate: de dónde parte el reloj del personal

| Situación | clockStartDate | cycleKey |
|---|---|---|
| `RECIBIDO` o `EN_REVISION` con `cycleCount ≤ 1` | `receptionDate` | `0` |
| `EN_REVISION` con `cycleCount > 1` y `reviewStartDate` definido | `reviewStartDate` (= `reentryDate` del ciclo) | `1` |
| `SUBSANACION_PENDIENTE_REINGRESO` | `null` — reloj del personal **pausado** | — |
| `OBSERVADO_PENDIENTE_RECOJO` | `null` — reloj del personal **pausado** | — |

Durante `SUBSANACION`, el plazo activo pertenece a la empresa (`subsanacionDeadlineDate`), no al personal.

---

## Ciclo de vida de subsanacionDeadlineDate

1. Se asigna al transicionar a `SUBSANACION_PENDIENTE_REINGRESO`:
   ```
   subsanacionDeadlineDate = addWorkingDays(obsPickedDate, dto.subsanacionDays)
   ```
2. Permanece activo mientras el estado sea `SUBSANACION_PENDIENTE_REINGRESO`.
3. Se limpia (`null`) cuando la empresa reingresa mediante `POST /procedures/:id/cycles`.

---

## Dos capas de cálculo: buildResponse vs. scheduler nocturno

### `buildResponse` (en cada request GET)

Recalcula en tiempo real usando el caché actual:

**Para el personal (estados RECIBIDO / EN_REVISION):**
```
deadlineDate          = addWorkingDays(clockStartDate, deadlineDays)
daysElapsed           = countWorkingDays(clockStartDate, hoy)
daysRemaining         = countWorkingDays(hoy, deadlineDate)   // negativo si vencido
isOverdue             = hoy > deadlineDate
```

**Para la empresa (estado SUBSANACION_PENDIENTE_REINGRESO):**
```
subsanacionDeadlineDate   → valor almacenado (no se recalcula desde caché)
subsanacionDaysRemaining  = countWorkingDays(hoy, subsanacionDeadlineDate)   // negativo si vencido
isSubsanacionOverdue      = hoy > subsanacionDeadlineDate
```

### Scheduler nocturno — 00:05 AM (`ProcedureSchedulerService`)

Persiste en BD para permitir filtros con índice en alertas y reportes:

```
procedure.deadlineDate   ← recalculado desde caché (solo para RECIBIDO / EN_REVISION)
procedure.daysElapsed    ← días hábiles transcurridos del personal
procedure.isOverdue      ← true si hoy > deadlineDate (solo cuando reloj del personal está activo)
```

El scheduler **no toca** `subsanacionDeadlineDate` (es inmutable desde que se almacena). Para detectar subsanaciones vencidas en alertas, se puede filtrar directamente por `subsanacionDeadlineDate < hoy` con el índice de BD disponible.

### Por qué `deadlineDate` en BD puede estar desactualizado

Si se agrega un feriado que cae dentro de la ventana activa, `deadlineDate` en BD queda stale hasta las 00:05 del día siguiente. `buildResponse` usa el caché actualizado al instante. Es el diseño esperado: no "arreglar" con recálculos adicionales.

---

## Cómputo de días hábiles

`ConfigCacheService` expone métodos que usan UTC en todos los cálculos internos:

**`addWorkingDays(from, days)`**: avanza un día a la vez, saltando sábados, domingos y fechas en `nonWorkingDays`.

**`countWorkingDays(from, to)`**: cuenta días hábiles en el rango `(from, to]` — inicio exclusivo, fin inclusivo.

Un día es inhábil si: `getUTCDay() === 0` (domingo), `getUTCDay() === 6` (sábado), o la fecha `"YYYY-MM-DD"` está en el Set de `nonWorkingDays`.
