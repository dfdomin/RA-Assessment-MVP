# RA Assessment — Medición institucional

Sistema web que reemplaza el flujo Excel/VBA de evaluación de Resultados de Aprendizaje (RA) en la IUB. El archivo de mapeo `MODULOS {cuatrimestre} POR RESULTADOS DE APRENDIZAJE.xlsx` es la fuente operativa de quién evalúa qué, en qué programa y bajo qué líder consolidador.

## Language

### Ciclo y estructura

**Ciclo de medición**:
Un cuatrimestre académico en el que se miden RAs (ej. `2025-2`). Un archivo Excel de mapeo corresponde a exactamente un ciclo.
_Avoid_: Período (cuando se refiere al cuatrimestre completo), semestre

**Línea propedéutica**:
Agrupación institucional de programas que comparten un informe ejecutivo (ej. CE-TGLI-ANI, TGA-INE). Una hoja del Excel de mapeo corresponde a una línea.
_Avoid_: Facultad, programa

**Programa**:
Carrera o ciclo formativo concreto (ej. Comercio Exterior, TG Administrativa). Columna `PROGRAMA` del Excel.
_Avoid_: Módulo, curso

### Roles

**Docente evaluador**:
Persona que califica estudiantes y redacta análisis cualitativo de un módulo para un RA concreto. Columna `DOCENTE` del Excel.
_Avoid_: Docente (sin calificar), profesor

**Líder consolidador de RA**:
Persona que consolida todos los módulos de un **programa × RA** en un informe. Columna `LIDER DE MEDICION DEL RA` del Excel. Distinta por cada combinación programa×RA.
_Avoid_: Líder de programa, líder de medición, admin

**Líder de medición**:
Persona (rol `admin`) que consolida el informe ejecutivo de toda una línea propedéutica. Aparece en el encabezado del Excel (Diego Domínguez).
_Avoid_: Decano, admin (sin contexto)

### Objetos de evaluación

**RA medido**:
Resultado de aprendizaje que el decano eligió evaluar en este ciclo. Marcado con `X` en columnas RA1–RA6 del Excel. No todos los RAs se miden siempre.
_Avoid_: Período, rúbrica

**Módulo físico**:
Instancia curso+grupo (`CODIGO` + `GRUPO 2025-2`). Puede medir varios RAs en el mismo ciclo.
_Avoid_: Período, clase

**Asignación módulo×RA**:
Vínculo entre un módulo físico y un RA que ese módulo debe medir en el ciclo. Una fila del Excel con tres `X` genera tres asignaciones (305 totales en 2025-2).
_Avoid_: Módulo (solo), período

**Criterio de desempeño**:
Fila evaluable de la rúbrica de un RA medido; en BD es un **indicador de desempeño (PI)**. Cada criterio tiene un texto propio y cuatro descriptores de nivel.
_Avoid_: Ítem suelto, pregunta, competencia (sin calificar)

**Rúbrica vigente**:
Conjunto de criterios de desempeño y descriptores del RA medido en el período de captura activo. El docente evaluador debe verla completa mientras califica.
_Avoid_: Rúbrica genérica, escala numérica suelta

**Panel de rúbrica fija**:
Zona superior de la pantalla de calificación donde permanece visible la rúbrica vigente: descripción del RA medido, cada criterio y los cuatro textos de nivel (valores **1, 2, 4 y 5**). Sustituye la antigua Pantalla 3b (paso «Revisar rúbrica» eliminado).
_Avoid_: Modal, tooltip como única referencia, paso duplicado de solo lectura antes de calificar

**Viewport de calificación**:
Resolución de diseño mínima **1024×768 px** (Guía IUB DG-TSI-09-V4). Objetivo: lote de cinco estudiantes + controles siempre visibles **sin scroll de página**. La rúbrica usa **desbordamiento interno (modo A)**; si no alcanza, **vista por criterio con pestañas (modo B)** — ambos implementados en UI.
_Avoid_: Scroll de página entero, ocultar descriptores ABET

**Desbordamiento de rúbrica (modo A)**:
Panel superior con altura acotada (~40 % del viewport de calificación) y **scroll solo dentro del panel**, manteniendo visibles las cinco filas de estudiantes abajo.
_Avoid_: Reducir descriptores a tooltips como única fuente

**Vista por criterio (modo B — respaldo)**:
Pestañas `Criterio 1…N` muestran **un** criterio con sus cuatro niveles completos; alternativa cuando el modo A no cabe o el docente la elige manualmente.
_Avoid_: Eliminar el modo A del código

**Lote de calificación**:
Grupo de hasta cinco estudiantes activos mostrados a la vez en la zona inferior para calificar sin buscar manualmente al siguiente.
_Avoid_: Página de estudiantes, grilla completa

**Avance de lote**:
El sistema ofrece pasar al siguiente lote de calificación solo cuando todos los estudiantes del lote actual tienen todos sus criterios de desempeño calificados. El docente **confirma** con un botón; no hay avance automático. Cada lote incluye **solo estudiantes activos** (los excluidos no ocupan cupo). Cada lote tiene **hasta cinco** activos; el último lote puede traer **menos de cinco** (ej. 1–4) sin cambiar el flujo.
_Avoid_: Paginación libre, scroll infinito sin regla de completitud, filas vacías de relleno, avance automático sin confirmación, mezclar excluidos en el lote

**Acción calificar más estudiantes**:
Botón visible al completar un lote. Cierra el lote actual y muestra el siguiente **lote de calificación** del **mismo módulo físico** y el **mismo RA medido**. Etiqueta fija en UI: **«Calificar más estudiantes»**. Sustituye expresiones como «siguiente grupo», que el docente puede confundir con el grupo del curso (`GRUPO 2025-2`) o con otro módulo.
_Avoid_: Siguiente grupo, siguiente módulo, siguiente RA

**Progreso de calificación**:
Contador persistente **«Estudiantes calificados: X de Y»** (Y = activos) e indicador de posición **«Lote N de M»** (ambos obligatorios en Pantalla 4).
_Avoid_: Porcentaje sin conteo absoluto, «grupo X de Y»

**Navegación entre lotes**:
El docente puede moverse libremente con **«Lote anterior»** y **«Lote siguiente»** entre lotes ya alcanzados o el siguiente pendiente, para corregir calificaciones sin listado completo de estudiantes. «Calificar más estudiantes» sigue siendo el avance principal hacia lotes nuevos no visitados.
_Avoid_: Solo avance hacia adelante sin retorno, grilla de todos los estudiantes como única forma de corregir

**Cierre de calificación**:
Cuando todos los estudiantes activos están calificados, el sistema muestra confirmación y el botón **«Continuar al análisis cualitativo»**, que lleva al paso de análisis del wizard (sin avance automático sin confirmación).

**Paso Análisis (wizard paso 3):** integra la **tabla F04b** (distribución del módulo: % primario, conteo entre paréntesis por PI y nivel) y los campos de **análisis cualitativo** por PI. No existe paso separado «Distribución»; el docente ve la tabla mientras escribe, como en el Excel.
_Avoid_: Saltar directo al envío, omitir el mensaje de cierre

**Orden del lote**:
Los estudiantes dentro de cada lote de calificación siguen el **orden de lista del módulo** (`roster_position` / columna `No.` del PDF Academusoft).
_Avoid_: Orden alfabético, orden aleatorio

**Wizard docente (5 pasos)**:
`Información` → `Lista de estudiantes` → `Calificaciones` → `Análisis (+ F04b)` → `Envío`. El paso Lista es obligatorio revisar; Calificaciones requiere ≥ 1 activo. Con nómina precargada por admin, el PDF en Lista es opcional (ADR-0002).
_Avoid_: Wizard de 4 pasos sin Lista, exigir PDF si ya hay precarga

**Persistencia de calificaciones**:
Cada selección de nivel se guarda con **auto-guardado debounced** (~1 s sin cambios): el cliente agrupa cambios pendientes y hace un `upsert` en batch a Supabase/PostgreSQL. Al pulsar **«Calificar más estudiantes»** se hace un flush final antes de validar el lote completo. No hay botón «Guardar calificaciones» separado.
_Avoid_: Guardado solo al avanzar de lote, una petición HTTP por cada clic sin debounce

**Lista de evaluación del módulo**:
Conjunto de estudiantes que el docente considera candidatos a calificar en ese módulo físico para el RA medido. Tras importar la matrícula, el docente puede **editarla** excluyendo quienes no deben evaluarse.
_Avoid_: Lista maestra del período (cuando se refiere solo al módulo), borrar estudiante

**Reporte Academusoft (PDF)**:
Archivo `Reporte_Estudiantes-*.pdf` («Listado de Estudiantes Inscritos») que el docente imprime desde Academusoft 4.0. Trae **Materia**, **Grupo** y tabla `No. / Documento / Código / Nombre Completo`. Es la fuente principal de importación en v1 (ADR-0002).
_Avoid_: Excel genérico, CSV del SIS (cuando se refiere al PDF institucional)

**Importación PDF (dos pasos)**:
(1) **Vista previa** — parseo sin escribir en BD: valida Materia/Grupo contra el módulo abierto y muestra la tabla extraída; (2) **Confirmación** — re-subida del mismo PDF + `consent_acknowledged` → upsert en BD.
_Avoid_: Import directo sin preview, confiar en JSON editado en el navegador

**Posición en lista (`roster_position`)**:
Entero en `module_students` que guarda el `No.` del PDF (o el orden de alta manual). Define el **orden de lista del módulo** para lotes de calificación (ADR-0001 + ADR-0002).
_Avoid_: Orden solo por `id` de inserción, orden alfabético

**PEGE_ID (estudiante)**:
Identificador de Persona General en Academusoft (`students.pege_id`, nullable en v1). El PDF no lo trae; lo rellena la integración Oracle (`oracle_adapter`). La clave operativa en v1 es `document_number`.
_Avoid_: Usar PEGE como clave de import PDF, confundir con `internal_id`

**Clave natural del estudiante (v1)**:
`document_number` (dígitos del campo `Documento` del PDF, sin prefijo `TI/CC`). `internal_id` = mismo valor en v1. Upsert por documento al importar.
_Avoid_: Upsert por `Código` del PDF, IDs sintéticos desde PK

**Exclusión de evaluación**:
Acción que saca a un estudiante de la **lista de evaluación** sin borrarlo del sistema: queda registrado con motivo (nunca asistió, se retiró, etc.) y no entra en lotes ni en el contador de calificados. Es la forma de **editar quién se evalúa** cuando la matrícula incluye personas que no asistieron o dejaron de asistir. Disponible en **Pantalla 3** y durante la calificación vía **«Editar lista de evaluación»**. Si el estudiante ya tenía calificaciones, estas **se conservan en BD** pero **no cuentan** para completitud ni reportes mientras esté excluido; al **re-incluir**, se reactivan.
_Avoid_: Eliminar estudiante, dar de baja en Academusoft, borrar calificaciones al excluir

**Aviso post-importación**:
Mensaje obligatorio tras cargar o confirmar estudiantes que explica al docente que puede **excluir de la evaluación** a matriculados que nunca asistieron o dejaron de asistir, antes de pasar a calificar.
_Avoid_: Asumir que el docente ya sabe excluir sin guía

**Nivel de desempeño**:
Una de cuatro opciones discretas por criterio y estudiante. Valores mostrados al docente: **1, 2, 4 y 5** (no existe el 3). Etiquetas ABET: Poor, Inadequate, Adequate, Exemplary.
_Avoid_: Nota continua, escala 1–5 completa, valor interno 3

**Etiqueta de nivel (matriz y captura)**:
Nombre ABET en español + valor canónico entre paréntesis. Ejemplo: `Deficiente (1)`, `Insuficiente (2)`, `Bueno (4)`, `Sobresaliente (5)`. Sin inglés (`Poor`…) ni interpretación corta (`No`, `Sí, pero`…). En **3c Calificar**, cada PI usa **radios horizontales** (uno exclusivo por nivel), no lista desplegable.
_Avoid_: Solo el número, descriptor completo repetido en cada celda, columnas bilingües tipo `Poor / 1 / (No)`

**Espacio horizontal (consigna UX)**:
Aprovechar filas antes de apilar: título + estado del módulo en una línea; nombre + `Doc.` del estudiante en una línea; cabecera del estudiante **fija** fuera del scroll. Ver `.cursor/rules/espacio-horizontal.mdc`.

### Flagged ambiguities

**Período** — resuelto así:
- **Ciclo de medición** = cuatrimestre (`2025-2`)
- **Período de captura** = ventana técnica en BD (`periods`) para capturar un RA (ej. `2025-2 RA3`)

**Grupo (del curso)** — resuelto así:
- **Grupo del curso** = instancia de matrícula del módulo físico (columna `GRUPO` del Excel; ej. `1_CE_G1`)
- **Lote de calificación** = bloque temporal de hasta cinco estudiantes en la pantalla de calificación; **no** es un grupo del curso
_Avoid_: Usar «grupo» para el lote de cinco estudiantes

## Example dialogue

**Experto IUB:** En 2025-2, el módulo ADM17 del programa Comercio Exterior mide RA3, RA4 y RA5.

**Dev:** Eso son tres **asignaciones módulo×RA** sobre un mismo **módulo físico**. Cada una tiene su **líder consolidador de RA** distinto según el mapeo.

**Experto IUB:** El docente envía tres veces, pero no elige destinatario.

**Dev:** Correcto: el sistema enruta cada envío al líder de esa combinación programa×RA. El **líder de medición** solo ve el panorama de línea para el informe ejecutivo.

**Experto IUB:** Al calificar RA5, el docente debe ver arriba toda la rúbrica con los textos de cada nivel, y abajo un lote de cinco estudiantes.

**Dev:** Eso es el **panel de rúbrica fija** más un **lote de calificación**. Cuando los cinco tienen todos los **criterios de desempeño** calificados, avanza el **avance de lote** al siguiente grupo.
