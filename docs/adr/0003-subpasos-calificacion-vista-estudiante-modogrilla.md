# ADR-0003: Subpasos de calificación, vista por estudiante y ModoGrilla

**Estado**: Aceptado (en implementación)  
**Fecha**: 2026-06-07  
**Contexto**: Sesión grill-me con el líder de medición (Diego). Reemplaza parcialmente la UX de calificación de ADR-0001 tras feedback de piloto: ponderación poco visible, pestañas PI confusas, y dolor de Excel al buscar el siguiente estudiante entre filas ya calificadas. Referencia comparativa: flujo de captura en [NAU e-ABET](https://www.cefns.nau.edu/~edo/Classes/CS_Capstone/Projects/S20/S20-HOCKING-e-ABET-data-viz-FINAL.pdf) (pestañas rúbrica + grilla estudiantes × PIs).

## Problema

El paso 3 **Calificaciones** monolítico actual:

1. Mezcla **ponderación**, **rúbrica** y **captura de notas** en una sola pantalla; el docente no percibe que debe configurar pesos (fila 12 del Excel).
2. La **vista por criterio** (pestañas PI-3.1…) desalinea la rúbrica visible con la grilla de calificación (4 columnas de selectores).
3. Reproduce el **dolor de Excel** al desplazarse entre estudiantes ya calificados para encontrar el siguiente pendiente.
4. No ofrece alternativa institucional para docentes o decanatura que prefieran la **grilla clásica** (estilo NAU).

ADR-0001 definió lote de 5 estudiantes y panel de rúbrica fijo; este ADR **sustituye** ese layout de captura por un modelo en tres subpasos con vista por estudiante como default.

## Decisión

### 1. Estructura del paso 3 (wizard principal sigue en 5 pasos)

El paso **3 Calificaciones** se divide en **subpasos internos** con sub-navegación propia (no se infla el wizard a 7 pasos):

| Subpaso | Nombre | Contenido | Bloqueo |
|---|---|---|---|
| **3a** | Ponderación | Pesos `%` editables por PI (`module_ra_evaluation_pi_weights`); validación suma = 100% | Obligatorio antes de 3b |
| **3b** | Rúbrica | Matriz completa **solo lectura** (todos los PIs, 4 descriptores por nivel); **sin** pestañas PI-3.1… | Checkbox obligatorio: «He revisado los criterios de desempeño» |
| **3c** | Calificar | Vista de captura (ver §2 y §3) | Requiere 3a válida + 3b confirmada |

**3a → ponderación tras calificar:** el docente **puede volver** a 3a desde 3c. Si ya existen filas en `assessments`, mostrar aviso: *«Cambiar pesos recalcula resultados ya guardados»* (los totales son en runtime; no corrompe BD).

### 2. Vista default en 3c — Por estudiante

Modo por defecto para **todos** los docentes (no requiere habilitación admin).

**Layout (un estudiante activo):**

- Encabezado: `Estudiante N de Y` + nombre en **texto grande** + documento.
- Por cada PI activo (bloque apilado vertical):
  - Código + descripción del criterio + peso `%`.
  - Matriz de 4 descriptores largos (Poor…Exemplary), alineada al Excel.
  - Selector de nivel con etiqueta corta: `Deficiente (1)`, `Insuficiente (2)`, `Bueno (4)`, `Sobresaliente (5)` — **sin** «No / Sí, pero / Sí» en el selector (esos textos permanecen solo en encabezados de la matriz de rúbrica).
- Navegación:
  - **Anterior** — estudiante previo en orden de lista.
  - Al completar los 4 PIs del estudiante activo: cuenta regresiva **3 segundos** con mensaje visible → avance automático al **siguiente pendiente**.
  - **Permanecer aquí** — cancela el salto automático.
  - **Sgte Estudiante** — visible tras cancelar (o para avanzar manualmente).
- Progreso global: `Estudiantes calificados: X de Y` (activos, orden de lista del módulo).
- Persistencia: auto-guardado debounced (ADR-0001); escala {1, 2, 4, 5}.

**Referencia ABET:** equivalente a tener la hoja de rúbrica del Excel **siempre visible** para el estudiante actual, sin scroll en 38 filas.

### 3. Vista alternativa — ModoGrilla

Habilitación **solo por administrador** (ver §4). Oculta para el resto.

**Al entrar a 3c** (solo docentes habilitados): selector de vista:

- `Por estudiante` (default, preseleccionado)
- `ModoGrilla`

**Bloqueo de modo:** tras el **primer guardado** de calificación en esa `module_ra_evaluation`, el modo elegido queda **fijado** (columna propuesta: `module_ra_evaluations.grading_view_mode` ∈ `student_card` | `grid`).

**Layout ModoGrilla:**

- Tabla estudiantes activos × columnas PI (estilo NAU/Excel).
- Filtro **«Solo pendientes»** activo por defecto (oculta filas con todos los PIs calificados).
- Toggle **«Ver todos»** para grilla completa.
- Mismos subpasos 3a y 3b obligatorios antes de entrar.
- Misma BD (`assessments`); solo cambia presentación.

### 4. Habilitación admin de ModoGrilla

| Mecanismo | Habilitar | Deshabilitar |
|---|---|---|
| **CSV** (carga masiva) | Sí — filas con columna `docente_email` | **No** — solo agrega; no modifica docentes ausentes del archivo |
| **Checkbox** (tabla admin) | Sí | **Sí** — marcar / desmarcar por docente |

**CSV — errores parciales (estilo F15):** habilitar correos válidos; reportar por fila los inválidos (correo no encontrado, usuario no docente, etc.). No abortar el lote completo por un typo.

**Sin contraseña** para acceder a ModoGrilla (decisión explícita: depende solo del flag admin).

**Datos propuestos:**

- `users.grid_grading_enabled BOOLEAN NOT NULL DEFAULT false`
- Plantilla CSV: `frontend/static/templates/template_modogrilla_docentes.csv` con cabecera `docente_email`
- Auditoría: evento `security_events` al aplicar CSV o cambiar checkbox (detalle: emails afectados, acción)

**UI admin:** sección en panel admin del dashboard — carga CSV + tabla buscable de docentes con checkbox ModoGrilla.

### 5. Lo que NO se implementa (rechazado en grill)

| Idea | Motivo |
|---|---|
| Franja contextual PI activo (modo B anterior) | No resuelve scroll; confuso con 4 columnas |
| Un PI × lote de 5 (modo C anterior) | Distinto al flujo acordado |
| Contraseña para ModoGrilla | Sustituido por flag admin |
| CSV «sincronizar» (deshabilitar ausentes) | Riesgo de deshabilitar por archivo incompleto |
| Cuestionario / caso ancla en 3b | MVP: solo checkbox |
| Preguntas de comprensión en 3b | Complejidad de contenido y mantenimiento |

### 6. Relación con NAU

| Capa | NAU (Excel) | IUB (este ADR) |
|---|---|---|
| Captura docente | Pestaña grilla todos × todos | **Default:** tarjeta por estudiante; **Opcional:** ModoGrilla |
| Rúbrica visible al calificar | Pestaña aparte | Integrada en 3b + bloques por PI en vista estudiante |
| Siguiente pendiente | Scroll manual | Auto-siguiente con cuenta regresiva |
| Reportes / tendencias | Dashboard NAU | Paso Análisis + panel líder (fuera de este ADR) |

## Alternativas consideradas

| Alternativa | Por qué se descartó |
|---|---|
| 7 pasos en wizard principal | Stepper demasiado largo en 1024×768 |
| Solo ModoGrilla | Pierde la mejora principal vs Excel para la mayoría |
| Solo vista por estudiante sin alternativa | Decanatura / docentes rezagados sin vía de retención |
| Lote de 5 (ADR-0001) | No elimina búsqueda del siguiente entre varios visibles |
| Habilitación solo por CSV | Falta afinación individual; checkbox complementa |

## Consecuencias

### Supersede parcial de ADR-0001

- ❌ Lote de 5 estudiantes en zona de captura (default).
- ❌ Panel de rúbrica fijo + pestañas PI en la misma pantalla que la grilla.
- ❌ Botón «Calificar más estudiantes» por lote (reemplazado por cuenta regresiva + «Sgte Estudiante»).
- ✅ Escala {1, 2, 4, 5}, auto-guardado, pesos por módulo, progreso X de Y, exclusión de inactivos.

### Implementación pendiente

1. Migración: `users.grid_grading_enabled`, `module_ra_evaluations.grading_view_mode`.
2. Refactor `frontend/assessment.html` + `module_assessment.js`: sub-stepper 3a/3b/3c, vista estudiante, ModoGrilla, selector de modo.
3. Panel admin: CSV + tabla checkbox (Edge Function o RPC con validación admin).
4. Actualizar `docs/PRD.md`, `DATA_MODEL.md`, `CONTEXT.md`, `TRACEABILITY_MATRIX.md` tras implementar.
5. Tests: completitud por modo, bloqueo de vista, CSV parcial, aviso al editar pesos con assessments existentes.

### Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Dos UIs divergen en datos | Misma tabla `assessments`; modo solo en presentación |
| CSV habilita correos erróneos parcialmente | Reporte por fila; no todo-o-nada |
| Docente en ModoGrilla reproduce scroll | Filtro «Solo pendientes» por defecto |
| Cambio de pesos tras calificar | Aviso en 3a; scores calculados en runtime |
| Modo cambia a mitad de evaluación | Bloqueo tras primer guardado en `grading_view_mode` |

## Referencias

- `docs/adr/0001-grading-ux-lotes-y-escala-1245.md` (parcialmente superseded)
- `docs/adr/0002-importacion-pdf-academusoft-lista-estudiantes.md`
- `supabase/migrations/0018_module_pi_weights_and_ra3_rubric.sql`
- [NAU e-ABET data viz (PDF)](https://www.cefns.nau.edu/~edo/Classes/CS_Capstone/Projects/S20/S20-HOCKING-e-ABET-data-viz-FINAL.pdf)
- [Washington State ABET assessment (pesos y pestañas)](https://peer.asee.org/assessment-of-program-outcomes-for-abet-accreditation.pdf)
- `CONTEXT.md` — términos de dominio
