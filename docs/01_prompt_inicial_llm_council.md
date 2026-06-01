# Prompt inicial para LLM Council

Quiero que ejecutes `llm-council` para pressure-testear la mejor estrategia de desarrollo de una aplicacion web usando Claude Code y/o Codex.

## Contexto y rol

Tengo un PRD ya definido para una aplicacion web. El PRD puede estar adjunto a esta conversacion, pegado en el contexto, o disponible como archivo en el workspace. Si no encuentras el PRD, preguntame una sola vez por su ruta o contenido antes de continuar.

Stack tecnico previsto:

- Backend: FastAPI
- Base de datos: PostgreSQL
- Frontend: por definir segun el PRD o la arquitectura recomendada
- Control de versiones: Git
- Desarrollo asistido por IA: Claude Code y/o Codex

Quiero construir la aplicacion con vibecoding asistido por IA, pero sin caer en el error de pedirle a Claude Code o Codex "haz todo" de una sola vez. Mi objetivo no es solo obtener codigo rapido, sino definir una metodologia de trabajo solida que aproveche la IA para planificar, dividir, implementar, probar, documentar y mantener continuidad entre sesiones.

Necesito decidir como abordar el proyecto de forma metodica, manteniendo buenas practicas reales de desarrollo de software.

## Tarea concreta

Ejecuta un `llm-council` con cinco perspectivas para responder esta decision:

> Cual es la mejor estrategia para desarrollar esta aplicacion web con Claude Code y/o Codex a partir del PRD, usando FastAPI y PostgreSQL, manteniendo buenas practicas de software, control de versiones, continuidad entre sesiones y una division por fases que permita avanzar aunque se agoten los tokens?

El council debe evaluar, comparar y recomendar una metodologia concreta de trabajo.

## Preguntas que debe responder el council

1. Conviene pedirle a Claude Code/Codex que construya toda la aplicacion de una vez, o dividir el proyecto en fases? Por que?
2. Si debe dividirse en fases, cuales deberian ser esas fases exactas desde el PRD hasta una version desplegable?
3. Que artefactos deberia generar antes de escribir codigo?
4. Como deberia estructurarse el repositorio para una app con FastAPI y PostgreSQL?
5. Como deberia usarse Git durante todo el proceso?
6. Como se debe manejar la continuidad cuando se agotan los tokens o se cambia de sesion?
7. Que archivos de memoria o documentacion deberia mantener el proyecto?
8. Que deberia hacer Claude Code/Codex en cada fase y que deberia revisar yo como humano?
9. Como se debe validar cada fase antes de pasar a la siguiente?
10. Que riesgos existen al usar IA para construir el proyecto de esta forma?
11. Cual seria el flujo ideal de trabajo diario o por sesion?
12. Cual deberia ser el primer prompt maestro que le de a Claude Code y a Codex despues del council?

## Criterios de calidad

La respuesta final debe ser practica, accionable y especifica. No quiero teoria generica sobre desarrollo de software.

El resultado debe ayudarme a tomar una decision clara sobre:

- como empezar
- como dividir el proyecto
- como trabajar con IA sin perder control
- como mantener continuidad entre sesiones
- como usar Git como sistema de seguridad
- como convertir el PRD en una app real por etapas
- como aprovechar FastAPI y PostgreSQL sin sobreingenieria

El council debe ser critico. No debe limitarse a validar mi idea. Debe senalar si estoy pensando mal el proceso, si estoy sobrecomplicando algo o si falta una etapa importante.

## Formato de respuesta

Usa el formato estandar de `llm-council`:

```md
## Where the Council Agrees

## Where the Council Clashes

## Blind Spots the Council Caught

## The Recommendation

## The One Thing to Do First
```

Despues del veredicto, anade una seccion extra:

```md
## Implementation Operating System
```

Incluye ahi:

1. Fases recomendadas del proyecto.
2. Archivos de documentacion que debo crear.
3. Flujo de Git recomendado.
4. Rutina por sesion con Claude Code/Codex.
5. Checklist de cierre de cada fase.
6. Prompt maestro inicial para Claude Code listo para copiar y pegar.
7. Prompt maestro inicial para Codex listo para copiar y pegar.

## Verificacion final

Antes de responder, verifica que la recomendacion final no sea generica. Debe poder convertirse inmediatamente en un plan de trabajo para construir la aplicacion desde el PRD.
