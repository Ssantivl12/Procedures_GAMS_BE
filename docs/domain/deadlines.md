# Sistema de plazos y días hábiles

## Arquitectura: BD + caché en memoria

Los plazos no son constantes en código: viven en la tabla `DeadlineConfig` y se cargan en memoria al iniciar el servidor. `ConfigCacheService` mantiene dos estructuras en memoria:

- **`deadlines` (Map)**: clave `"TIPO:cycleKey"` → días hábiles. Se recarga automáticamente cada vez que un endpoint de configuración crea, edita o elimina un `DeadlineConfig`.
- **`nonWorkingDays` (Set)**: fechas `"YYYY-MM-DD"` de la tabla `NonWorkingDay`. Se recarga automáticamente en cada mutación sobre esa tabla.

El caché nunca queda desincronizado con la BD: las mutaciones de configuración llaman a `refreshDeadlines()` o `refreshNonWorkingDays()` antes de responder.

---

## Plazos por defecto (seed)

`DeadlineConfig` usa solo dos `cycleNumber`: `0` (primera revisión) y `1` (todos los reingresos y subsanaciones). Cualquier `cycleCount >= 1` en el trámite se mapea a la clave de configuración `1`.

| Tipo | cycleNumber 0 (primera revisión) | cycleNumber 1 (reingresos / subsanación) |
|---|---|---|
| RAI | **5** días hábiles | **10** días hábiles |
| MAI_PMA | **15** días hábiles | **15** días hábiles |
| IAA | **10** días hábiles | **10** días hábiles |
| CIERRE | **10** días hábiles | — (sin reingreso) |

**Excepción RAI + PROYECTO**: cuando `companyStatus = PROYECTO`, la primera revisión usa `cycleKey 1` (10 días) en lugar de `cycleKey 0` (5 días). Esto aplica tanto en `buildResponse` como en el scheduler nocturno.

---

## clockStartDate: de dónde parte el reloj

El reloj de plazos no siempre empieza en la misma fecha; depende del estado actual y del número de ciclos:

| Situación | clockStartDate | cycleKey |
|---|---|---|
| `RECIBIDO` o `EN_REVISION` con `cycleCount ≤ 1` | `receptionDate` | `0` (o `1` si RAI+PROYECTO) |
| `EN_REVISION` con `cycleCount > 1` y `reviewStartDate` definido | `reviewStartDate` (= `reentryDate` del ciclo) | `1` |
| `SUBSANACION_PENDIENTE_REINGRESO` con `obsPickedDate` definido | `obsPickedDate` | `1` |
| `OBSERVADO_PENDIENTE_RECOJO` | `null` — reloj **pausado** | — |

Cuando `clockStartDate` es `null`, `daysElapsed` y `daysRemaining` no se calculan y se devuelven como `null` en la respuesta.

---

## Dos capas de cálculo: buildResponse vs scheduler nocturno

Existe una distinción importante entre lo que se calcula en tiempo real y lo que se persiste en BD.

### `buildResponse` (en cada request GET)

Recalcula siempre tres valores de forma dinámica usando el caché actual:

```
deadlineDate      = addWorkingDays(clockStartDate, deadlineDays)
daysElapsed       = countWorkingDays(clockStartDate, hoy)
daysRemaining     = countWorkingDays(hoy, deadlineDate)   // negativo si vencido
isOverdue         = hoy > deadlineDate
```

Los valores devueltos en la respuesta **siempre son frescos**: reflejan el caché actual del momento del request. El `deadlineDate` en la respuesta puede diferir del campo `deadlineDate` almacenado en la tabla `procedure`.

### Scheduler nocturno — 00:05 AM (`ProcedureSchedulerService`)

Cron: `5 0 * * *`. Aplica la misma lógica que `buildResponse` y persiste en BD:

```
procedure.deadlineDate  ← recalculado desde caché
procedure.daysElapsed   ← días hábiles transcurridos
procedure.isOverdue     ← true si hoy > deadlineDate
```

**Por qué existe el scheduler si buildResponse ya recalcula**: los campos en BD permiten filtros eficientes con índice (`WHERE isOverdue = true`, `ORDER BY daysElapsed`) que usan los endpoints de alertas y reportes. Sin el scheduler, esos filtros requerirían calcular en runtime para cada fila.

### Por qué `deadlineDate` en BD puede estar desactualizado

Si se agrega un feriado (`NonWorkingDay`) que cae dentro de la ventana de plazo de un trámite activo, el `deadlineDate` en BD queda inmediatamente stale hasta las 00:05 del día siguiente. Sin embargo:

- `buildResponse` usa el caché actualizado al instante → la respuesta del GET ya es correcta.
- El scheduler de la noche reconcilia el valor en BD.

No hay un bug: es el diseño esperado. No "arreglar" el scheduler ni agregar recalculos adicionales por este motivo.

---

## Cómputo de días hábiles

`ConfigCacheService` expone dos métodos que usan UTC en todos los cálculos internos:

**`addWorkingDays(from, days)`**: avanza un día a la vez, saltando sábados, domingos y fechas en `nonWorkingDays`.

**`countWorkingDays(from, to)`**: cuenta días hábiles en el rango `(from, to]` — el día de inicio es exclusivo, el de fin es inclusivo.

Un día es inhábil si: `getUTCDay() === 0` (domingo), `getUTCDay() === 6` (sábado), o la fecha `"YYYY-MM-DD"` está en el Set de `nonWorkingDays`.

Los feriados se gestionan en `POST/DELETE /configuration/non-working-days` (SuperAdmin). Cada mutación dispara `refreshNonWorkingDays()` inmediatamente, de modo que cualquier GET posterior ya usa la lista actualizada.
