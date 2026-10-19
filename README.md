# AULA-IA · Curso docente y evidencias

Sitio interactivo de la Red de Docentes Transdisciplinar de México para un curso práctico de inteligencia artificial dirigido a docentes.

## Sesiones disponibles

- Sesión 1: De la pregunta rápida al trabajo con contexto.
- Sesión 2: Fuentes, NotebookLM y producción anclada.
- Sesión 3: Diseño de actividades y secuencias didácticas con IA.
- Sesión 4: Evaluación formativa y retroalimentación con IA.
- Sesión 5: Instrumentos de evaluación y análisis de evidencias con IA.
- Rutas preparatorias de 60 minutos para las sesiones 2, 3, 4 y 5.

Cada sesión principal dura 90 minutos. Las rutas preparatorias son espacios opcionales de nivelación y no sustituyen la asistencia ni la evidencia de la sesión principal.

## Funciones

- actividades interactivas y rutas de dificultad adaptativa;
- ejemplos para educación básica, media superior y superior;
- asistencia, nivelación y evidencia de salida;
- confirmaciones visibles y opciones de contingencia;
- persistencia principal en Cloudflare D1;
- réplica institucional a Google Sheets cuando el receptor está configurado;
- recursos descargables para participantes y ponentes.

## Privacidad y evidencia

Los tableros públicos muestran únicamente información agregada. Los registros nominales y los productos de trabajo no se publican en el sitio. Las actividades solicitan ejemplos anonimizados y evitan datos identificables de estudiantes.

## Desarrollo y validación

Requiere Node.js 22.13 o posterior.

```bash
npm install
npm run db:generate
npm run dev
npm run build
```

La declaración lógica de D1 está en `.openai/hosting.json`, el esquema en `db/schema.ts` y las migraciones generadas en `drizzle/`.
