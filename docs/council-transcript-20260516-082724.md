# LLM Council Transcript — Lineas Propedeuticas y Resumen Ejecutivo

Fecha: 2026-05-16

## Pregunta Original

Evaluar si la RA Assessment App contempla la estructura institucional `Modulos -> Programas -> Lineas Propedeuticas`, el rol Decano o autoridad equivalente, y la generacion de un resumen ejecutivo agregado por linea propedeutica.

Ejemplos:

- Ruta A: Tecnico en Informatica/Telecomunicaciones -> Tecnologia correspondiente -> Profesional en Ingenieria Telematica.
- Ruta B: Tecnologia en Gestion Administrativa -> Profesional en Inteligencia de Negocios.

## Evidencia Local Revisada

- `docs/PRD.md` describe la app como reemplazo del Excel/VBA usado por el programa TGA.
- `docs/PRD.md` marca multiples programas academicos como fuera de alcance de v1.
- El modelo actual incluye `User`, `StudentOutcome`, `Period`, `Rubric`, `Module`, `ModuleAssignment`.
- No existen entidades `Program`, `PropedeuticLine`, `EducationalPathway`, `AcademicCycle` ni equivalente.
- La matriz de roles solo contempla `admin`, `leader`, `teacher`.
- No hay rol `dean`, `decan`, `faculty_admin` ni autoridad ejecutiva equivalente.
- Los reportes documentados son por periodo, modulo, lider o reporte ABET del programa; no existe resumen ejecutivo por linea propedeutica.

## Respuestas del Consejo

### Contrarian

No esta debidamente contemplado. El sistema esta estructurado para un flujo de acreditacion de un solo programa, no para una jerarquia institucional. El fallo principal es estructural: sin `Program`, `PropedeuticLine`, `AcademicCycle` y permisos por autoridad ejecutiva, cualquier resumen ejecutivo seria una convencion manual sobre datos que no codifican la estructura real de la institucion.

### First Principles Thinker

Desde primeros principios, la app modela ejecucion de assessment dentro de una unidad operativa, no gobierno institucional. La pregunta ejecutiva por linea propedeutica no puede responderse si los datos no saben a que programa pertenece cada modulo ni a que ruta pertenece cada programa.

### Expansionist

La oportunidad es convertir la app de herramienta de assessment de programa a plataforma institucional. Para eso se deben agregar jerarquia academica, comparativos entre programas, tendencias por periodo, riesgos por linea, cumplimiento de evidencias y drill-down desde linea propedeutica hasta modulo.

### Outsider

Para alguien externo, si se habla de lineas propedeuticas, programas y decano, esos conceptos deberian aparecer como entidades visibles. Si no aparecen en datos, permisos ni pantallas, el sistema no lo soporta. No es un detalle de UI: falta el lenguaje basico del dominio.

### Executor

La ruta practica es tratarlo como cambio mayor de alcance: agregar entidades de jerarquia, migrar TGA al nuevo modelo, anadir rol ejecutivo, crear endpoints de resumen, actualizar docs y pruebas. No conviene improvisarlo sobre `Period` o `Module` porque el reporte ejecutivo quedaria fragil y dificil de auditar.

## Veredicto

La funcionalidad no esta adecuadamente contemplada en el PRD, documentos derivados ni codigo. La necesidad aparece solo por ausencia: el PRD incluso declara que multiples programas academicos estan fuera del alcance de v1. El codebase confirma esa limitacion.

Para soportar el alcance institucional se requiere una ampliacion deliberada del dominio:

- `Program`
- `PropedeuticLine` o `EducationalPathway`
- `AcademicCycle` o campo equivalente para tecnico, tecnologico y profesional
- relacion de `Module` con `Program`
- relacion de `Program` con `PropedeuticLine`
- rol `dean` o autoridad equivalente
- endpoints y pantallas de resumen ejecutivo por linea propedeutica
- pruebas y matriz de permisos para acceso institucional de solo lectura y drill-down

## Primer Paso Recomendado

Actualizar el PRD como cambio de alcance mayor: declarar que el producto pasa de "v1 solo TGA" a "plataforma institucional multi-programa", o registrar esta capacidad como sprint futuro independiente antes de tocar codigo.

