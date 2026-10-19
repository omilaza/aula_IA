# AULA-IA · Curso docente y evidencias

Curso práctico de inteligencia artificial para docentes, con sesiones S1–S6,
rutas preparatorias, asistencia, cuestionarios, evidencias y comprobantes PDF.

Esta versión usa **Google Sheets en tu Drive como almacenamiento principal**.
Cloudflare aloja la web. No crea, consulta ni requiere una base D1.

## Activar Google y Cloudflare

La conexión de Google Drive con ChatGPT no otorga credenciales al Worker.
Debes publicar una aplicación web de Apps Script que reciba las operaciones
del servidor y configure el acceso a tu hoja privada.

1. Abre la nueva hoja de registros con la cuenta de Google que será su
   propietaria. Desde **Extensiones → Apps Script**, crea el proyecto asociado.
2. Copia los archivos [Code.gs](google-apps-script/Code.gs) y
   [Schema.gs](google-apps-script/Schema.gs) en dos archivos de código del proyecto.
3. En **Configuración del proyecto**, activa la visualización del manifiesto
   `appsscript.json` y sustituye su contenido por
   [el manifiesto del repositorio](google-apps-script/appsscript.json).
   Incluye el servicio avanzado **Google Sheets API v4**. En un proyecto de
   Google Cloud predeterminado se habilita al guardar; si usas un proyecto
   estándar, habilita también Google Sheets API en ese proyecto.
4. En **Propiedades de la secuencia de comandos**, añade:

   | Propiedad | Valor |
   | --- | --- |
   | `SPREADSHEET_ID` | El ID entre `/d/` y `/edit` en la URL de la nueva hoja |
   | `AULA_STORAGE_SECRET` | Un secreto aleatorio de al menos 32 caracteres |

   Puedes generar el secreto localmente con `openssl rand -hex 32`.
   No lo guardes en el código, en la hoja ni en GitHub.
5. Ejecuta **`setupStorage`** desde el editor y autoriza el acceso a Sheets.
   Comprueba que termina correctamente. Valida o crea las 13 pestañas `APP_`;
   no modifica las hojas históricas. Conserva sus nombres y encabezados exactos.
6. Selecciona **Implementar → Nueva implementación → Aplicación web**:
   ejecutar como **tú** y acceso **Cualquier persona**. Copia la URL terminada
   en **`/exec`**, no la URL de prueba `/dev`.
   Esto publica el receptor protegido por secreto; la hoja sigue siendo privada.
   Si la cuenta institucional no permite esta opción, su administrador debe
   habilitarla antes de poder usar este puente.
7. En Cloudflare, abre tu Worker → **Settings → Variables and Secrets**.
   Añade como **secretos de ejecución** (no solo variables del build):

   | Secreto | Valor |
   | --- | --- |
   | `GOOGLE_SHEETS_WEBHOOK_URL` | La URL `/exec` publicada en el paso anterior |
   | `GOOGLE_SHEETS_WEBHOOK_SECRET` | Exactamente el mismo `AULA_STORAGE_SECRET` |
   | `PDF_EXPORT_SECRET` | Otro secreto aleatorio de al menos 32 caracteres |

   Si ya tenías `PDF_EXPORT_SECRET`, conserva su valor para no invalidar los
   códigos de descarga emitidos con esa clave.
8. En **Settings → Build**, selecciona:

   | Campo | Valor |
   | --- | --- |
   | Rama | `google-sheets-storage` (o `main` después de integrar esta rama) |
   | Directorio raíz | Raíz del repositorio |
   | Build | `npm run build` |
   | Deploy | `npm run deploy` |

   Despliega después de configurar Google y los secretos. El token solo
   necesita los permisos habituales para publicar el Worker, sin D1 Edit.

## Verificar antes de usar con participantes

- Registra una asistencia de prueba e identifica la fila en `APP_ASISTENCIA`.
- Repite el registro con el mismo correo y sesión: debe actualizar la fila.
- Envía el diagnóstico: debe aparecer en `APP_CUESTIONARIOS`.
- Completa una evidencia y descarga su comprobante con el código recibido.
- Envía una encuesta: debe quedar en `APP_SATISFACCION` y aparecer en los
  agregados del tablero, sin publicar nombre, correo ni comentarios.

La app solo confirma el guardado tras la respuesta de Google. Si falta
configuración o Google no responde, informa el error y permite reintentar.
Las operaciones reenviadas por el servidor conservan su identificador para
evitar duplicados e incrementos repetidos; la encuesta también conserva su folio.

## Datos y capacidad

Cada categoría tiene su propia pestaña con columnas completas. Los
cuestionarios conservan sus respuestas estructuradas en `answersJson`, además
de puntuación, correo y folio; `likertAverage` está expresado en centésimas.
Los datos de participantes se leen solo desde el servidor. Las estadísticas
públicas son agregadas y los PDF requieren el código de descarga correspondiente.
Los textos se escriben en modo RAW para impedir que una respuesta se ejecute
como fórmula de Sheets.

**Los registros anteriores no se importan automáticamente.** La hoja histórica
y cualquier D1 existente permanecen intactos. Los códigos y PDFs históricos
requieren migrar sus registros completos, además de conservar la clave PDF.
Esta implementación no borra recursos anteriores.

Google Sheets y Apps Script tienen cuotas y menor capacidad para muchos
envíos simultáneos que una base dedicada. Las escrituras usan un bloqueo para
evitar colisiones. Prueba la carga prevista antes de una sesión masiva; este
cambio no garantiza la misma capacidad que D1. Las pruebas automatizadas usan
servicios simulados y no sustituyen la validación en tu cuenta de Google.

## Desarrollo y pruebas

Requiere Node.js 22.13 o posterior.

```bash
npm ci
npm run typecheck
npm test
```

Para desarrollo local, configura los tres secretos en `.dev.vars` y ejecuta
`npm run dev`. Ese entorno escribe en la hoja configurada: usa una hoja y una
implementación de prueba si no quieres modificar datos reales.

`db/schema.ts` conserva los tipos y claves del modelo. Para regenerar el
manifiesto de Sheets después de modificarlo, ejecuta `npm run sheets:schema`.
Los directorios `drizzle/`, `examples/d1/` y `.openai/` son material histórico
del respaldo original y no participan en el almacenamiento de este Worker.

## Por qué falló el primer despliegue

El respaldo de Sites incluía el ID D1 de ejemplo
`00000000-0000-4000-8000-000000000000`. La compilación terminaba, pero Cloudflare
rechazaba el despliegue con **10181** porque esa base no existía en tu cuenta.
Esta rama elimina la vinculación D1 y cambia las lecturas y escrituras a Sheets;
no se limita a quitar el ID de la configuración.
