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

## Desplegar en tu propia cuenta de Cloudflare

En **Workers & Pages → aula-ia → Settings → Build**, configura:

| Campo | Valor |
| --- | --- |
| Rama de producción | `main` |
| Directorio raíz | Raíz del repositorio |
| Comando de compilación | `npm run build` |
| Comando de despliegue | `npm run deploy` |

Usa el nuevo comando de despliegue en lugar de `npx wrangler deploy`.
El script busca la base D1 `aula-ia-db` en la cuenta autenticada; si no existe,
la crea. Después configura su ID real en el artefacto compilado, aplica las
migraciones pendientes de `drizzle/` y publica el Worker. En despliegues
posteriores reutiliza la misma base. Si ya tienes otra D1 destinada a este
proyecto, cambia `database_name` y añade su `database_id` en `wrangler.jsonc`
antes de compilar.

El token API de Workers Builds debe poder desplegar Workers y leer/escribir
D1 en esa cuenta. Si aparece un error de autorización durante `d1 list`,
`d1 create` o las migraciones, asigna el permiso **Account → D1 → Edit** al
token usado por el build y vuelve a ejecutar el despliegue. No guardes tokens
en este repositorio.

Para desplegar desde una computadora autenticada en Cloudflare:

```bash
npm ci
npx wrangler login
npm run build
npm run deploy
```

La base de una cuenta nueva empieza vacía. El respaldo de código no incluye
los registros existentes de Sites. La réplica a Sheets y la firma de PDF
requieren configurar los secretos descritos en `.env.example` en el Worker.

### Causa del error 10181 del respaldo original

La configuración de Vite utilizaba `site-creator-d1` con el ID de ejemplo
`00000000-0000-4000-8000-000000000000`, destinado a ser reemplazado por el
entorno de Sites. Ese ID no existe en una cuenta externa. El código compilaba,
pero Cloudflare rechazaba la versión al validar la vinculación `DB`.
La configuración nativa está ahora en `wrangler.jsonc`, sin ese ID ficticio.
