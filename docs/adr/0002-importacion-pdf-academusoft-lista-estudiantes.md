# ADR-0002: Importación de lista de estudiantes desde PDF Academusoft

**Estado**: Aceptado  
**Fecha**: 2026-06-07  
**Contexto**: Sesión grill-me con el líder de medición (Diego). Fixtures de referencia: `Reporte_Estudiantes-17.pdf` (38 filas) y `Reporte_Estudiantes-18.pdf` (18 filas) — reportes «Listado de Estudiantes Inscritos» de Academusoft 4.0.

## Problema

El docente obtiene la nómina del módulo como **PDF** desde Academusoft (`Reporte_Estudiantes-*.pdf`), no como CSV estructurado. El MVP tenía:

- Import docente solo para CSV/XLSX con columnas `internal_id`, `document_number`, `full_name`.
- Upsert por `internal_id` en `POST /modules/{id}/students/import`.
- Sin paso dedicado «Lista de estudiantes» en el wizard (4 pasos: Info → Calificaciones → Análisis → Envío).
- Sin `pege_id` en estudiantes ni `roster_position` en matrícula.
- Sin `UNIQUE` en `document_number`.

Se requiere un flujo optimizado para el PDF fijo de Academusoft, alineado al dominio (una persona = un documento) y a la integración hexagonal futura con Oracle.

## Formato PDF de referencia (Academusoft 4.0)

Encabezado (validación de módulo):

| Campo PDF | Ejemplo | Mapeo BD |
|---|---|---|
| **Materia** | `ADM18-PROCESAMIENTO DE LA INFORMACIÓN…` | Prefijo = `modules.course_code` |
| **Grupo** | `1_CE_G2` | = `modules.group_name` |

Tabla de estudiantes:

| Columna PDF | Uso en app |
|---|---|
| `No.` | `module_students.roster_position` |
| `Documento` | `TI - 1042856266` → `document_number` = `1042856266` (solo dígitos) |
| `Código` | **Ignorado** — en la práctica repite el documento o viene `0` |
| `Nombre Completo` | `students.full_name` |

Pie (no importar): bloque «Señor Docente… legalizar matrícula» y tabla «Horario».

## Decisión

### Identidad y persistencia (P1–P3, P7, P11, P15)

1. **Clave natural de upsert**: `document_number` (dígitos normalizados del campo `Documento`).
2. **`internal_id`**: mismo valor que `document_number` en v1 (import PDF y alta manual). No se usa el PK ni fórmulas derivadas.
3. **Nombre**: si el documento ya existe, **siempre** actualizar `full_name` al del PDF/import más reciente (último import gana).
4. **`students.pege_id`**: `VARCHAR(50) UNIQUE NULLABLE` desde v1; `NULL` en import PDF; lo rellena `oracle_adapter` (Persona General Academusoft). Simétrico a `users.pege_id`.
5. **`UNIQUE(document_number)`** en `students`. En import concurrente: capturar violación de unicidad, re-leer por documento y continuar (retry).
6. **Alta manual** (paso Lista): solo **número de documento** + **nombre completo**; el sistema asigna `internal_id` automáticamente.

### Validación y re-import (P4–P5)

7. **Encabezado obligatorio**: bloquear import si `Grupo` ≠ `module.group_name` (normalizado) o si `Materia` no empieza por `module.course_code`. Mensaje explícito con materia/grupo del PDF vs. módulo abierto. **No se escribe nada en BD**.
8. **Re-import additive**: el import solo agrega/actualiza; **nunca** excluye ni borra automáticamente. Si hay estudiantes del módulo que no aparecen en el PDF, mostrar aviso en resumen para que el docente los revise y **excluya manualmente** si corresponde (F03 §3e).

### Flujo UI y wizard (P6, P8, P12, P14)

9. **PDF en dos pasos**: (1) vista previa sin escritura en BD — tabla parseada + validación Materia/Grupo; (2) confirmación con checkbox Ley 1581 (`consent_acknowledged`) + re-subida del mismo PDF → commit.
10. **Wizard de 5 pasos**: `[ Información ] → [ Lista de estudiantes ] → [ Calificaciones ] → [ Análisis (+ F04b) ] → [ Envío ]`. Calificaciones bloqueada hasta **≥ 1 estudiante activo**.
11. **UI v1 del paso Lista**: solo **import PDF Academusoft** + alta manual. CSV/XLSX docente en iteración posterior (el endpoint legado puede mantenerse).
12. **Nómina precargada (F15)**: si el módulo ya tiene estudiantes, el paso Lista muestra la tabla existente; PDF **opcional**; aviso post-importación F03 la **primera vez** que se abre el paso (no saltar el paso).

### Orden y API (P9–P10)

13. **`module_students.roster_position`**: entero tomado de la columna `No.` del PDF en cada import; consultas de lista y lotes ordenan por este campo. Re-import actualiza posición de quienes vienen en el PDF; quienes no vienen conservan posición. Altas manuales al final.
14. **API**:
    - `POST /api/v1/modules/{id}/students/import/preview` — parsea PDF, valida encabezado, devuelve filas + avisos (incl. P5); **sin BD**.
    - `POST /api/v1/modules/{id}/students/import` — recibe PDF + `consent_acknowledged=true`, **re-parsea**, upsert, asigna `roster_position`; registra `students_imported`.

### Parser (P13)

15. **Estrategia híbrida** en `src/services/academusoft_pdf.py` (o módulo equivalente):
    - Primario: **pdfplumber** — detección de tabla por encabezado `No. / Documento / Código / Nombre Completo`.
    - Respaldo: extracción de texto + **regex** por línea si pdfplumber devuelve &lt; 1 fila válida.
    - Cortar parsing al pie «Señor Docente» / «legalizar matrícula».

## Alternativas consideradas

| Alternativa | Por qué se descartó |
|---|---|
| `internal_id` = últimos 4 PK + últimos 4 documento | PK inexistente en primer import; colisiones; mezcla identidad visual con clave de dominio |
| Upsert solo por `internal_id` | PDF no trae ID interno fiable; `Código` suele ser `0` o repetir documento |
| Validar `Código` del PDF | Redundante con `Documento`; PDF-18 tiene todos los códigos en `0` |
| Excluir automáticamente quien no está en re-import | Riesgo si el parser falla o el PDF está incompleto |
| Vista previa con JSON del cliente (sin re-subir PDF) | Superficie de manipulación; incoherente con parser defensivo §17 |
| Paso Lista omitido si hay precarga | El docente podría no revisar ni excluir no-asistentes (riesgo ABET) |
| UI v1 con CSV/XLSX + PDF | Diluye el foco; dos flujos de preview antes de validar PDF en producción |
| Solo regex / solo pdfplumber | Menos robusto ante variaciones de layout entre listas cortas y largas |

## Consecuencias

### Migraciones

- `supabase/migrations/0016_pdf_import_student_fields.sql`
- `students.pege_id VARCHAR(50) UNIQUE NULLABLE`
- `UNIQUE(students.document_number)` (valores `[SUPRIMIDO-{id}]` tras habeas data no colisionan con cédulas reales)
- `module_students.roster_position INT NOT NULL DEFAULT 0` + índice `(module_id, roster_position)`

### Código

- ✅ **MVP (producción)**: Edge Function `students-import` + `_shared/academusoft_pdf.ts` (`unpdf` + regex)
- ✅ **Legacy (referencia/tests)**: `src/services/academusoft_pdf.py` (pdfplumber + regex)
- ✅ `_shared/students_roster.ts` — upsert compartido con `bulk-import` (admin CSV)
- ✅ `RaApi.studentsImportPreview` / `RaApi.studentsImportConfirm` en `frontend/js/api.js`
- Smoke test Deno: `deno run -A scripts/test_academusoft_pdf_edge.ts`
- Paso 2 en `frontend/assessment.html` + `module_assessment.js` (o módulo `module_roster.js`).
- «Editar lista de evaluación» desde calificación navega al paso 2.

### Tests

- Golden files: `Reporte_Estudiantes-17.pdf`, `Reporte_Estudiantes-18.pdf`.
- Preview: Materia/Grupo OK, 38 y 18 filas respectivamente.
- Preview bloqueado con PDF de otro grupo.
- Import idempotente; `roster_position` preserva orden `No.`.
- Concurrencia: dos imports mismo documento → un registro `students`.

### Documentación pendiente de propagar

- `CONTEXT.md` — términos de import PDF y wizard 5 pasos
- `docs/PRD.md` §F03.3a, §Pantalla 3, §F05, changelog v2.7
- `docs/DATA_MODEL.md`, `docs/API_CONTRACT.md`, `docs/TEST_PLAN.md`, `docs/TRACEABILITY_MATRIX.md`

## Referencias

- `Reporte_Estudiantes-17.pdf`, `Reporte_Estudiantes-18.pdf` (fixtures en raíz del repo)
- `docs/adr/0001-grading-ux-lotes-y-escala-1245.md` — orden de lista del módulo, aviso post-importación, exclusión
- `src/api/routers/students.py` — import actual CSV/XLSX
- `src/integration/sync_service.py` — `_upsert_student` por `document_number`
- `docs/PRD.md` §17 — parser defensivo
