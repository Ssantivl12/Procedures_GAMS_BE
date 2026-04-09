# Roles y permisos

## Los cuatro roles

| Rol | Descripción |
|---|---|
| `SUPERADMIN` | Acceso total. Administra usuarios, configuración global y puede revertir cualquier acción. |
| `ENCARGADO` | Acceso operativo completo. Mismas capacidades que Inspector y Secretaria, más gestión de expedientes y reactivaciones. |
| `SECRETARIA` | Recepción administrativa: registra trámites, fechas y reingresos. No puede revisar ni cerrar. |
| `INSPECTOR` | Revisión técnica: toma casos, emite observaciones, cierra trámites. |

Un usuario puede tener múltiples roles simultáneamente. Los roles se evalúan con lógica OR: basta con tener uno de los roles requeridos.

---

## Matriz de permisos por módulo

### Usuarios

| Acción | SUPERADMIN | ENCARGADO | SECRETARIA | INSPECTOR |
|---|:---:|:---:|:---:|:---:|
| Crear usuario | ✓ | | | |
| Listar usuarios | ✓ | ✓ | | |
| Ver propio perfil (`/me`) | ✓ | ✓ | ✓ | ✓ |
| Editar usuario | ✓ | | | |
| Eliminar usuario | ✓ | | | |
| Listar inspectores | ✓ | ✓ | | |

### Empresas

| Acción | SUPERADMIN | ENCARGADO | SECRETARIA | INSPECTOR |
|---|:---:|:---:|:---:|:---:|
| Crear empresa | ✓ | ✓ | ✓ | |
| Listar / ver empresa | ✓ | ✓ | ✓ | ✓ |
| Editar empresa | ✓ | ✓ | ✓ | |
| Eliminar empresa (soft) | ✓ | ✓ | | |
| Reactivar empresa | ✓ | | | |
| Ver expediente de empresa | ✓ | ✓ | ✓ | ✓ |

### Expedientes (CaseFile)

| Acción | SUPERADMIN | ENCARGADO | SECRETARIA | INSPECTOR |
|---|:---:|:---:|:---:|:---:|
| Crear expediente | ✓ | ✓ | ✓ | |
| Listar / ver expediente | ✓ | ✓ | ✓ | ✓ |
| Editar expediente | ✓ | ✓ | | |
| Cerrar expediente | ✓ | ✓ | | |
| Reabrir expediente | ✓ | | | |
| Eliminar expediente | ✓ | | | |

### Trámites (Procedures)

| Acción | SUPERADMIN | ENCARGADO | SECRETARIA | INSPECTOR |
|---|:---:|:---:|:---:|:---:|
| Crear trámite | ✓ | ✓ | ✓ | |
| Listar / ver trámite | ✓ | ✓ | ✓ | ✓ |
| Editar campos (notas, hoja de ruta) | ✓ | ✓ | | |
| Eliminar trámite | ✓ | | | |
| Asignar inspector | ✓ | ✓ | | |
| Ver historial de auditoría | ✓ | ✓ | ✓ | ✓ |

### Transiciones de estado

| Transición | SUPERADMIN | ENCARGADO | SECRETARIA | INSPECTOR |
|---|:---:|:---:|:---:|:---:|
| RECIBIDO → EN_REVISION | ✓ | ✓ | | ✓ |
| EN_REVISION → OBSERVADO | ✓ | ✓ | | ✓ |
| EN_REVISION → CERRADO | ✓ | ✓ | | ✓ |
| OBSERVADO → SUBSANACION | ✓ | ✓ | ✓ | |
| SUBSANACION → EN_REVISION (`POST /cycles`) | ✓ | ✓ | ✓ | |
| Cualquier activo → ABANDONADO | ✓ | ✓ | ✓ | ✓ |
| ABANDONADO → estado anterior (reactivar) | ✓ | ✓ | | |

### Ciclos

| Acción | SUPERADMIN | ENCARGADO | SECRETARIA | INSPECTOR |
|---|:---:|:---:|:---:|:---:|
| Crear ciclo (`POST /cycles`) | ✓ | ✓ | ✓ | |
| Listar / ver ciclos | ✓ | ✓ | ✓ | ✓ |
| Cerrar ciclo manualmente | ✓ | ✓ | | ✓ |

### Observaciones

| Acción | SUPERADMIN | ENCARGADO | SECRETARIA | INSPECTOR |
|---|:---:|:---:|:---:|:---:|
| Crear observación | ✓ | ✓ | | ✓ |
| Listar / ver observaciones | ✓ | ✓ | ✓ | ✓ |
| Editar observación | ✓ | ✓ | | ✓ |
| Resolver observación | ✓ | ✓ | | ✓ |
| Reabrir observación | ✓ | ✓ | | |
| Eliminar observación | ✓ | | | |

### Documentos

| Acción | SUPERADMIN | ENCARGADO | SECRETARIA | INSPECTOR |
|---|:---:|:---:|:---:|:---:|
| Subir documento | ✓ | ✓ | ✓ | ✓ |
| Listar / ver / descargar | ✓ | ✓ | ✓ | ✓ |
| Ver versiones | ✓ | ✓ | ✓ | ✓ |
| Eliminar documento | ✓ | | | |

### Configuración

| Acción | SUPERADMIN | ENCARGADO | SECRETARIA | INSPECTOR |
|---|:---:|:---:|:---:|:---:|
| Ver tipos de trámite | ✓ | ✓ | ✓ | ✓ |
| Editar tipo de trámite | ✓ | | | |
| Ver plazos (DeadlineConfig) | ✓ | ✓ | ✓ | ✓ |
| Crear / editar / eliminar plazos | ✓ | | | |
| Ver días no laborables | ✓ | ✓ | ✓ | ✓ |
| Crear / editar / eliminar feriados | ✓ | | | |

### Reportes y alertas

| Acción | SUPERADMIN | ENCARGADO | SECRETARIA | INSPECTOR |
|---|:---:|:---:|:---:|:---:|
| Dashboard | ✓ | ✓ | ✓ | ✓ |
| Alertas (vencidos, por vencer, etc.) | ✓ | ✓ | ✓ | ✓ |
| Reportes generales | ✓ | ✓ | ✓ | ✓ |
| Reporte de actividad | ✓ | ✓ | | |

---

## Implementación técnica

Los permisos se declaran en el controller con dos decorators combinados:

```ts
@UseGuards(JwtAuthGuard, RolesGuard)   // siempre en el controller, nunca en el service
@Roles(UserRole.INSPECTOR, UserRole.ENCARGADO, UserRole.SUPERADMIN)
async changeStatus(...) {}
```

`RolesGuard` usa `Reflector` para leer `@Roles` del handler o de la clase, con prioridad al handler. Si un endpoint no tiene `@Roles`, el guard lo permite (solo requiere JWT válido).

Los roles del usuario viajan en el payload del JWT y **no requieren query a BD por request**. El único momento en que los roles se leen frescos de BD es en `POST /auth/refresh` (al emitir un nuevo access token).

---

## Reglas de consistencia

- Un usuario desactivado (`isActive=false`) no puede hacer login, pero su access token actual sigue siendo válido hasta que expire. Para bloqueo inmediato, el SUPERADMIN debe también revocar los refresh tokens desde BD.
- Cambiar el rol de un usuario surte efecto en el próximo refresh del access token del usuario afectado (máximo `JWT_EXPIRES_IN` de retraso).
- Un usuario puede tener múltiples roles. ENCARGADO implica en la práctica un superconjunto de INSPECTOR y SECRETARIA, pero los roles son aditivos, no jerárquicos: cada `@Roles(...)` declara explícitamente qué roles acepta.
