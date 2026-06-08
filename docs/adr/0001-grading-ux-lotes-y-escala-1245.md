# ADR-0001: UX de calificación por lotes y escala de niveles {1, 2, 4, 5}

**Estado**: Aceptado  
**Fecha**: 2026-06-07  
**Contexto**: Sesión grill-with-docs / grill-me con el líder de medición (Diego).

## Problema

El Excel ABET muestra la rúbrica completa del RA (descriptores largos por criterio y nivel) y usa valores de score **1, 2, 4 y 5** (sin 3). La implementación MVP tenía:

- Grilla de todos los estudiantes × todos los PIs sin panel de rúbrica fijo.
- Valores almacenados `1–4` ordinal en BD y PRD contradictorio respecto al Excel.
- Botón manual «Guardar calificaciones».

Se requiere cumplir propósito ABET (definiciones siempre visibles) y UX (no buscar al siguiente estudiante manualmente).

## Decisión

### Pantalla de calificación (F03)

1. **Panel de rúbrica fija** (zona superior, sticky): descripción del RA medido + todos los criterios de desempeño con descriptores largos de los cuatro niveles, columnas alineadas al Excel (`Poor/1/No`, `Inadequate/2/Sí pero`, `Adequate/4/Sí`, `Exemplary/5/Sí aún más`).
2. **Lote de calificación** (zona inferior): hasta **5** estudiantes activos del módulo, en **orden de lista del módulo**.
3. **Zona inferior — layout**: una fila por estudiante; selectores compactos por criterio con **etiqueta de selector** (`Deficiente — No (1)`, etc.). Los párrafos largos solo arriba.
4. **Progreso**: `Estudiantes calificados: X de Y` (obligatorio).
5. **Avance de lote**: confirmación explícita con botón **«Calificar más estudiantes»** (no «siguiente grupo»). El último lote puede tener 1–4 estudiantes.
5b. **Navegación entre lotes**: controles **«Lote anterior»** / **«Lote siguiente»** e indicador **«Lote N de M»** para corregir lotes ya visitados sin abandonar el flujo por lotes.
6. **Persistencia**: auto-guardado debounced (~1 s) con `upsert` en batch; flush al avanzar de lote.
7. **Lotes y exclusiones**: solo **estudiantes activos** entran en los lotes de calificación; los **excluidos** no consumen cupo del lote de cinco.
8. **Lista de evaluación (Pantalla 3)**: tras importar estudiantes, **aviso post-importación** que explica que puede excluir matriculados que nunca asistieron o dejaron de asistir; la exclusión se entiende como **editar la lista de evaluación**, no como borrar al estudiante.
9. **Exclusión durante calificación**: enlace **«Editar lista de evaluación»** desde Pantalla 4; al volver, el docente retoma el mismo lote sin perder borradores del resto. Calificaciones de un excluido se **conservan** pero no cuentan hasta re-inclusión.
10. **Pantalla 3b eliminada**: no hay paso intermedio «Revisar rúbrica»; el panel fijo en Pantalla 4 cumple ABET.
11. **Viewport 1024×768**: lote de 5 estudiantes + controles sin scroll de **página**; el lote de cinco responde a este límite.
12. **Desbordamiento de rúbrica**: modo **A** — scroll interno en panel de rúbrica (~40 % viewport). Modo **B** (respaldo, implementado en código) — pestañas por criterio con un descriptor expandido; conmutación manual o automática si el modo A desborda.
13. **Cierre de calificación**: al calificar el último activo, mensaje de éxito + botón **«Continuar al análisis cualitativo»** (paso Análisis del wizard); no avance automático.
14. **Paso Distribución eliminado**: la tabla F04b del Excel (filas 53–62: % por criterio y nivel, conteo secundario) queda **siempre visible** en el paso **Análisis** (arriba de los campos de texto por PI). Wizard de **4 pasos**: Info → Calificaciones → Análisis → Envío.

### Escala de datos

- `assessments.level` y `pi_levels.level_value` ∈ **{1, 2, 4, 5}** (`CHECK` en PostgreSQL).
- Valor **3** prohibido (no existe en Excel ABET de la IUB).
- Migración `0015_level_values_1245.sql` remapea datos legados: `3→4`, `4→5`.
- Fórmula de contribución por PI: `pi_percentage = level × pi_weight / 5`.

## Alternativas consideradas

| Alternativa | Por qué se descartó |
|---|---|
| Grilla completa estudiantes × PIs | El docente pierde referencia ABET; mucho scroll |
| Un PI a la vez abajo con rúbrica completa arriba | Más pasos; no era necesario si la rúbrica completa cabe arriba |
| Avance automático de lote | Riesgo de saltar sin revisar |
| Escala ordinal 1–4 en BD | No coincide con Excel ni con lo que el docente debe ver |
| Guardado solo al pulsar «Calificar más estudiantes» | Pérdida de trabajo si cierra el navegador |

## Consecuencias

- Actualizar PRD v2.5, `DATA_MODEL.md`, `API_CONTRACT.md`, `TEST_PLAN.md`, `TRACEABILITY_MATRIX.md`, `ARCHITECTURE.md`.
- Implementar UI del panel fijo y paginación por lotes (pendiente de desarrollo frontend).
- Tests y validadores Pydantic rechazan `level = 3`.
- `CONTEXT.md` es la fuente de términos de dominio para esta UX.

## Referencias

- `CONTEXT.md` — panel de rúbrica fija, lote de calificación, etiqueta de selector, acción calificar más estudiantes
- `docs/PRD.md` §F03.3b–3g, §Pantalla 4
- `supabase/migrations/0015_level_values_1245.sql`
