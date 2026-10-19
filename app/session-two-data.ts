export const sessionTwoTitle = "Documentos, fuentes y contexto pedagógico";

export const prepAgenda = [
  { time: "0–5", minutes: 5, label: "Bienvenida y ruta", detail: "Registro de nivelación y propósito de la hora" },
  { time: "5–15", minutes: 10, label: "Habilidad digital básica", detail: "Abrir pestañas, copiar, pegar y reconocer una confirmación" },
  { time: "15–30", minutes: 15, label: "Demostración paso a paso", detail: "Trabajar con una fuente breve en una herramienta de IA" },
  { time: "30–50", minutes: 20, label: "Práctica guiada", detail: "Preguntar, copiar el resultado, revisarlo y volver a la plataforma" },
  { time: "50–55", minutes: 5, label: "Comprobación interactiva", detail: "Ordenar pasos e identificar información segura" },
  { time: "55–60", minutes: 5, label: "Evidencia y transición", detail: "Guardar la práctica y continuar a la sesión principal" },
];

export const mainAgenda = [
  { time: "0–5", minutes: 5, label: "Bienvenida y recuperación", detail: "Registro principal y conexión con la Sesión 1", active: false },
  { time: "5–20", minutes: 15, label: "Microcontenido", detail: "Documento, fuente, afirmación, inferencia y contexto pedagógico", active: false },
  { time: "20–40", minutes: 20, label: "Demostración", detail: "Comparar una respuesta general con una respuesta anclada en una fuente", active: true },
  { time: "40–70", minutes: 30, label: "Laboratorio", detail: "Construir un producto docente basado en una fuente", active: true },
  { time: "70–80", minutes: 10, label: "Revisión interactiva", detail: "Distinguir afirmaciones sustentadas, inferencias y vacíos", active: true },
  { time: "80–90", minutes: 10, label: "Evidencia y cierre", detail: "Registrar producto, revisión, riesgo y ajuste", active: true },
];

export const digitalQuestions = [
  "¿Puedes crear una cuenta digital sin ayuda?",
  "¿Sabes iniciar sesión con correo y contraseña?",
  "¿Puedes recuperar el acceso a una cuenta?",
  "¿Sabes abrir un enlace?",
  "¿Puedes cambiar entre pestañas?",
  "¿Sabes copiar y pegar texto?",
  "¿Puedes utilizar un menú desplegable?",
  "¿Puedes seleccionar una opción?",
  "¿Puedes completar y enviar un formulario?",
  "¿Puedes identificar si una respuesta fue registrada?",
  "¿Has utilizado alguna herramienta de inteligencia artificial?",
  "¿Puedes escribir un prompt básico?",
  "¿Necesitas acompañamiento paso a paso?",
];

export const courseSource = `CASO DIDÁCTICO AULA-IA. Documento simulado; no es una norma oficial.

La Escuela Horizonte organizará una jornada de lectura de 45 minutos. Participarán tres grupos y cada docente seleccionará un texto breve adecuado a su nivel. La actividad deberá incluir diez minutos de lectura individual, quince minutos de conversación en parejas, quince minutos para construir una recomendación y cinco minutos de cierre. Solo se utilizarán textos de acceso autorizado. No se registrarán nombres, calificaciones ni información personal del alumnado. El producto esperado es una recomendación grupal de lectura con una justificación basada en el texto consultado.`;

export const prepPrompt = `Usa únicamente la fuente que aparece entre delimitadores. No agregues datos, normas ni autores que no estén escritos allí.

--- FUENTE ---
${courseSource}
--- FIN DE LA FUENTE ---

Responde con:
1. el propósito de la jornada;
2. los cuatro momentos y su duración;
3. un dato que no debe registrarse;
4. una pregunta que todavía no puede responderse con esta fuente.`;

export const cases = [
  {
    key: "basica",
    level: "Educación básica",
    title: "Lectura con evidencia",
    purpose: "Diseñar una actividad breve sin inventar condiciones que la fuente no contiene.",
    product: "Consigna de lectura, cuatro momentos y boleto de salida.",
    source: courseSource,
  },
  {
    key: "media",
    level: "Media superior",
    title: "Interpretar datos sin inventar causas",
    purpose: "Convertir un reporte simulado en una actividad de análisis que separe dato e hipótesis.",
    product: "Actividad de 25 minutos con tabla de evidencia y pregunta de verificación.",
    source: `CASO DIDÁCTICO AULA-IA. Reporte simulado, elaborado para la práctica.\n\nDurante cuatro semanas se registró el uso de agua de un plantel: 11 200, 10 600, 9 800 y 9 500 litros. El registro permite calcular diferencias y describir una tendencia. No contiene información sobre fugas, campañas, clima, número de personas ni causas del cambio. Cualquier explicación causal deberá presentarse como hipótesis y requerirá otra fuente.`,
  },
  {
    key: "superior",
    level: "Educación superior",
    title: "Síntesis con límites explícitos",
    purpose: "Construir una guía de seminario que distinga lo informado por la fuente de lo que debe verificarse.",
    product: "Guía de discusión con síntesis, preguntas y límites de la evidencia.",
    source: `CASO DIDÁCTICO AULA-IA. Nota académica simulada.\n\nUn seminario de formación docente analizará tres prácticas: explicitar criterios antes de una tarea, ofrecer retroalimentación durante el proceso y permitir una revisión del producto. La nota sostiene que las tres prácticas buscan hacer visible el aprendizaje, pero no aporta datos de eficacia, tamaño de muestra ni comparación entre niveles educativos. El grupo deberá usar la nota para formular preguntas de análisis y señalar qué afirmaciones necesitarían investigación adicional.`,
  },
] as const;

export const promptLevels = [
  {
    level: "Básico",
    prompt: "Resume la fuente en tres ideas. Después escribe una pregunta que la fuente no permita responder. No agregues información externa.",
  },
  {
    level: "Intermedio",
    prompt: "Organiza la respuesta en una tabla con: afirmación, fragmento o dato de apoyo, uso pedagógico posible y asunto por verificar.",
  },
  {
    level: "Avanzado",
    prompt: "Diseña un recurso docente viable para el contexto indicado. Vincula cada decisión importante con la fuente, marca las inferencias y termina con una lista de límites y verificaciones pendientes.",
  },
];

export const evidenceChecklist = [
  "El propósito de aprendizaje es claro.",
  "El contexto no contiene datos personales de estudiantes.",
  "La fuente utilizada está identificada.",
  "El prompt limita la respuesta a la fuente o pide marcar información externa.",
  "El producto solicitado es viable para el tiempo y los recursos.",
  "La revisión distingue dato, inferencia y asunto por verificar.",
  "Se identificó al menos un riesgo o vacío.",
  "Se realizó un ajuste concreto antes de guardar.",
];

export const claimCheck = [
  {
    id: "c1",
    statement: "La jornada dura 45 minutos.",
    correct: "sustentada",
    feedback: "La duración aparece de manera explícita en la fuente.",
  },
  {
    id: "c2",
    statement: "El alumnado está muy motivado por la lectura.",
    correct: "no_sustentada",
    feedback: "La fuente no informa motivación ni opiniones del alumnado.",
  },
  {
    id: "c3",
    statement: "La conversación en parejas podría ayudar a contrastar interpretaciones.",
    correct: "inferencia",
    feedback: "Es una posibilidad pedagógica razonable, pero no es un resultado afirmado por la fuente.",
  },
];

export const orderSteps = [
  "Leer la fuente y reconocer sus límites.",
  "Definir el propósito docente.",
  "Escribir una pregunta que obligue a usar la fuente.",
  "Revisar qué está sustentado y qué fue inferido.",
  "Registrar la evidencia y confirmar el guardado.",
];

export const faq = [
  ["¿Necesito una cuenta de pago?", "No. La actividad esencial puede realizarse con una cuenta gratuita disponible o pegando la fuente en un chat de IA."],
  ["¿Debo subir un archivo?", "No. Utiliza el texto de práctica integrado y copia el resultado de la IA en los campos internos."],
  ["¿NotebookLM elimina los errores?", "No. Ayuda a trabajar con fuentes, pero la interpretación, la revisión y la decisión final siguen siendo docentes."],
  ["¿Qué hago si una herramienta no abre?", "Usa ChatGPT o Gemini con el texto de la fuente pegado dentro del prompt y continúa con la misma evidencia."],
  ["¿Puedo usar datos de estudiantes?", "No. Trabaja con casos anonimizados y nunca pegues nombres, calificaciones, diagnósticos o datos sensibles."],
] as const;
