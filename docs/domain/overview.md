# IRAPS — Visión general del dominio

## Qué problema resuelve

El sistema digitaliza la gestión de expedientes ambientales **IRAPS** (Instrumento de Regulación de Alcance Particular de Sacaba) del Gobierno Autónomo Municipal de Sacaba (GAMS). Centraliza documentos, estados de trámites, plazos en días hábiles y trazabilidad de cambios que antes se manejaban en papel o herramientas dispersas. No tiene registro público: todos los usuarios son creados por un SuperAdmin.

## Categorías de empresa

Las empresas se clasifican en **Categoría 3 (C3)** o **Categoría 4 (C4)** según su impacto ambiental. Las empresas C4 solo pueden tener un RAI y, si corresponde, un Plan de Cierre. Las empresas C3 siguen una cadena de dependencias obligatoria: primero el RAI, luego el MAI-PMA, y a partir de ahí presentan un IAA anual; también pueden tener un Plan de Cierre por evento.

## Jerarquía de entidades

Cada **Empresa** (`Company`) tiene exactamente un **Expediente** (`CaseFile`), identificado por un código generado automáticamente (formato `EXP-YYYY-NNNNN`). El expediente agrupa todos los **Trámites** (`Procedure`) de esa empresa a lo largo del tiempo. Un trámite no puede existir sin un expediente, y un expediente no puede cerrarse mientras tenga trámites activos.

## Tipos de trámite

**RAI** es el registro ambiental base con vigencia de 5 años, requisito previo a cualquier otro trámite. **MAI-PMA** es el plan de manejo ambiental, exclusivo de C3 y habilitado solo tras un RAI cerrado. **IAA** es el informe ambiental anual que las empresas C3 presentan antes del 30 de mayo por el año anterior. **CIERRE** es el plan de cierre o abandono que se abre por evento (cambio de rubro, traslado o cierre total) y sigue un flujo simplificado sin observaciones.

## Roles

**SECRETARIA** registra la recepción de trámites, marca fechas administrativas y gestiona reingresos. **INSPECTOR** toma los trámites en revisión, registra observaciones y cierra el trámite con el documento final. **ENCARGADO** tiene las mismas capacidades que Inspector y Secretaría, además de reactivar trámites abandonados. **SUPERADMIN** agrega la administración de usuarios, feriados y parámetros de alertas.
