# Cambios de API — Plazos (para equipo Frontend)

> Rama: `fix/general`  
> Fecha: 2026-04-13

---

## Resumen ejecutivo

Se separaron los plazos en **dos relojes independientes**: uno para el personal técnico (revisión) y otro para la empresa (subsanación). Antes existía un solo `deadlineDate` que cambiaba de significado según el estado del trámite. Ahora cada uno tiene su propio campo y sus propias métricas.

---

## 1. Nuevo campo requerido en `PATCH /procedures/:id/status`

Al transicionar a `SUBSANACION_PENDIENTE_REINGRESO` ahora se **requiere** enviar `subsanacionDays`.

### Antes
```json
{
  "toStatus": "SUBSANACION_PENDIENTE_REINGRESO",
  "obsPickedDate": "2026-04-10"
}
```

### Ahora
```json
{
  "toStatus": "SUBSANACION_PENDIENTE_REINGRESO",
  "obsPickedDate": "2026-04-10",
  "subsanacionDays": 15
}
```

| Campo | Tipo | Validación | Descripción |
|---|---|---|---|
| `subsanacionDays` | `number` (entero) | Requerido, mínimo 1 | Días hábiles que tiene la empresa para subsanar, contados desde `obsPickedDate`. Lo determina el técnico. |

> **Impacto**: el formulario de transición a SUBSANACION debe agregar un campo numérico para que el técnico ingrese los días.

---

## 2. Respuesta de trámite — nuevos campos

Los endpoints que devuelven un trámite (`GET /procedures`, `GET /procedures/:id`, `PATCH /procedures/:id/status`, etc.) ahora incluyen tres campos adicionales:

```jsonc
{
  // ... campos existentes ...

  // Plazo del personal (sin cambios de semántica, ver nota §3)
  "deadlineDate": "2026-04-20",
  "daysRemaining": 5,
  "isOverdue": false,

  // NUEVO: Plazo de la empresa (solo activo en estado SUBSANACION_PENDIENTE_REINGRESO)
  "subsanacionDeadlineDate": "2026-05-05",   // null si no hay subsanación activa
  "subsanacionDaysRemaining": 12,            // null si no hay subsanación activa
  "isSubsanacionOverdue": false              // false si no hay subsanación activa
}
```

### Descripción de los campos nuevos

| Campo | Tipo | Cuándo tiene valor | Descripción |
|---|---|---|---|
| `subsanacionDeadlineDate` | `string \| null` | Estado `SUBSANACION_PENDIENTE_REINGRESO` | Fecha límite de la empresa para subsanar |
| `subsanacionDaysRemaining` | `number \| null` | Estado `SUBSANACION_PENDIENTE_REINGRESO` | Días hábiles restantes (negativo = vencida hace N días) |
| `isSubsanacionOverdue` | `boolean` | Siempre | `true` si la empresa superó su plazo de subsanación |

### Cuándo mostrar cada bloque en la UI

| Estado del trámite | Mostrar `deadlineDate` / `daysRemaining` | Mostrar `subsanacionDeadlineDate` / `subsanacionDaysRemaining` |
|---|:---:|:---:|
| `RECIBIDO` | ✅ | ❌ |
| `EN_REVISION` | ✅ | ❌ |
| `OBSERVADO_PENDIENTE_RECOJO` | ❌ (reloj pausado) | ❌ |
| `SUBSANACION_PENDIENTE_REINGRESO` | ❌ (reloj pausado) | ✅ |
| `CERRADO` / `ABANDONADO` | ❌ | ❌ |

---

## 3. Cambio de comportamiento: `deadlineDate` en estado SUBSANACION

**Antes**: al transicionar a `SUBSANACION_PENDIENTE_REINGRESO`, `deadlineDate` se sobreescribía con el plazo de subsanación (se usaba como deadline "activo" sin importar el estado).

**Ahora**: `deadlineDate` **mantiene el valor del último plazo de revisión del personal** y no se modifica durante la subsanación. El plazo de la empresa vive exclusivamente en `subsanacionDeadlineDate`.

> **Impacto**: si el frontend mostraba `deadlineDate` como "plazo vigente" durante el estado SUBSANACION, ahora debe cambiar a `subsanacionDeadlineDate` en ese estado. `daysRemaining` e `isOverdue` también quedan inactivos (`null` / `false`) durante SUBSANACION.

---

## 4. Corrección de días según tipo y estado de empresa

Los valores de `deadlineDate` calculados para trámites RAI y MAI-PMA con `companyStatus = PROYECTO` cambian respecto al comportamiento anterior. Esto afecta la **visualización del plazo** en el detalle del trámite.

| Tipo | companyStatus | Ciclo | Días ANTES | Días AHORA |
|---|---|---|:---:|:---:|
| RAI | PROYECTO | Primer ciclo | 10 | **5** |
| RAI | PROYECTO | Reingresos | 10 | **5** |
| RAI | OPERACIONES / otros | Primer ciclo | 5 | **10** |
| RAI | OPERACIONES / otros | Reingresos | 10 | 10 _(sin cambio)_ |
| MAI_PMA | PROYECTO | Primer ciclo | 15 | 15 _(sin cambio)_ |
| MAI_PMA | PROYECTO | Reingresos | 15 | **10** |

> Ningún cambio de UI es necesario para esto — los campos ya existen, solo cambia el número calculado.

---

## 5. Campos sin cambios

Los siguientes campos **no cambian** ni en nombre, ni en tipo, ni en comportamiento fuera de lo descrito arriba:

- `receptionDate`, `obsPickedDate`, `reviewStartDate`
- `daysElapsed`
- `cycleCount`, `reentryCount`
- Todos los campos de estado (`currentStatus`, `currentStatus`, etc.)
- Todos los endpoints de ciclos (`POST /procedures/:id/cycles`)
- La API de configuración de deadlines (`/configuration/deadlines`)

---

## Checklist de cambios para el FE

- [ ] Formulario de transición a SUBSANACION: agregar input numérico para `subsanacionDays`
- [ ] Vista detalle de trámite: mostrar `subsanacionDeadlineDate` y `subsanacionDaysRemaining` cuando el estado es `SUBSANACION_PENDIENTE_REINGRESO`
- [ ] Vista detalle de trámite: en estado `SUBSANACION_PENDIENTE_REINGRESO`, dejar de mostrar `deadlineDate` / `daysRemaining` del personal (o marcarlos como inactivos) y usar los campos de subsanación
- [ ] Indicador de vencimiento: usar `isSubsanacionOverdue` para el badge de alerta durante SUBSANACION (en lugar de `isOverdue`, que estará en `false`)
- [ ] Actualizar tipos TypeScript del cliente si se tiene un schema generado o interfaz manual del trámite
