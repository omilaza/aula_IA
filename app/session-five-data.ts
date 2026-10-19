export const sessionFiveTitle =
  "Instrumentos de evaluación y análisis de evidencias con IA";

export const sessionFiveSubtitle =
  "Del criterio observable al tablero que orienta una decisión docente";

export const sessionFiveSimulationNotice =
  "Todos los casos, fuentes, grupos y resultados de esta sesión son ficticios y fueron creados exclusivamente para practicar sin exponer datos del alumnado.";

export const prepAgenda = [
  {
    time: "0–5",
    minutes: 5,
    label: "Entrada y propósito",
    detail: "Registro independiente y presentación del recorrido de nivelación",
  },
  {
    time: "5–15",
    minutes: 10,
    label: "Del producto a la decisión",
    detail: "Relacionar evidencia, criterio, instrumento, dato y decisión docente",
  },
  {
    time: "15–27",
    minutes: 12,
    label: "Demostración acompañada",
    detail: "Comparar cinco instrumentos y reconocer para qué sirve cada uno",
  },
  {
    time: "27–42",
    minutes: 15,
    label: "Minilaboratorio 1",
    detail: "Construir una lista de cotejo de cuatro indicadores observables",
  },
  {
    time: "42–52",
    minutes: 10,
    label: "Minilaboratorio 2",
    detail: "Interpretar ocho resultados ficticios sin atribuir causas",
  },
  {
    time: "52–57",
    minutes: 5,
    label: "Revisión docente",
    detail: "Comparar la propuesta propia con un borrador de IA y decidir qué ajustar",
  },
  {
    time: "57–60",
    minutes: 3,
    label: "Registro y transición",
    detail: "Guardar la evidencia de nivelación e incorporarse a la sesión principal",
  },
] as const;

export const mainAgenda = [
  {
    time: "0–5",
    minutes: 5,
    label: "Asistencia y activación",
    detail: "Registrar la entrada y recuperar el ciclo de evaluación de la Sesión 4",
    active: false,
  },
  {
    time: "5–15",
    minutes: 10,
    label: "Microcontenido dialogado",
    detail: "Del criterio al dato y del dato a una decisión docente verificable",
    active: false,
  },
  {
    time: "15–28",
    minutes: 13,
    label: "Demostración comparativa",
    detail: "Contrastar cinco instrumentos, sus usos y sus límites",
    active: true,
  },
  {
    time: "28–50",
    minutes: 22,
    label: "Laboratorio 1 · Instrumento",
    detail: "Derivar y revisar un instrumento a partir de una secuencia didáctica",
    active: true,
  },
  {
    time: "50–60",
    minutes: 10,
    label: "Puente hacia los datos",
    detail: "Reconocer estructura, denominadores, faltantes y límites del conjunto ficticio",
    active: true,
  },
  {
    time: "60–78",
    minutes: 18,
    label: "Laboratorio 2 · Hoja y tablero",
    detail: "Analizar 50 resultados de tres grupos y formular hallazgos prudentes",
    active: true,
  },
  {
    time: "78–85",
    minutes: 7,
    label: "Auditoría y decisión docente",
    detail: "Aceptar, adaptar o rechazar la propuesta de IA con una justificación",
    active: true,
  },
  {
    time: "85–90",
    minutes: 5,
    label: "Evidencia y cierre",
    detail: "Guardar instrumento, análisis, decisión y evidencia de seguimiento",
    active: true,
  },
] as const;

export const prepTotalMinutes = prepAgenda.reduce(
  (sum, item) => sum + item.minutes,
  0,
);

export const mainTotalMinutes = mainAgenda.reduce(
  (sum, item) => sum + item.minutes,
  0,
);

export const mainActiveMinutes = mainAgenda
  .filter((item) => item.active)
  .reduce((sum, item) => sum + item.minutes, 0);

export const assessmentCycle = [
  "Secuencia",
  "Evidencia",
  "Instrumento",
  "Datos",
  "Patrón",
  "Retroalimentación",
  "Decisión docente",
  "Nueva evidencia",
] as const;

export type SessionFiveCaseKey =
  | "primaria"
  | "secundaria"
  | "media-superior"
  | "superior";

export type SessionFiveGroup = "G1" | "G2" | "G3";

export type InstrumentKey =
  | "rubrica_analitica"
  | "lista_cotejo"
  | "escala_valoracion"
  | "guia_observacion"
  | "portafolio_evidencias";

export type DifficultyKey = "basico" | "intermedio" | "avanzado";

export type SequenceMoment = {
  readonly label: "Inicio" | "Desarrollo" | "Cierre";
  readonly minutes: number;
  readonly teacherActions: string;
  readonly studentActions: string;
  readonly evidence: string;
};

export type SessionFiveSequence = {
  readonly key: SessionFiveCaseKey;
  readonly level: string;
  readonly grade: string;
  readonly subject: string;
  readonly title: string;
  readonly classDuration: number;
  readonly context: string;
  readonly diagnosticStartingPoint: string;
  readonly learningPurpose: string;
  readonly contentAndProcesses: readonly string[];
  readonly sourceMaterial: string;
  readonly evidenceProduct: string;
  readonly moments: readonly SequenceMoment[];
  readonly resources: readonly string[];
  readonly inclusion: readonly string[];
  readonly assessmentMoment: string;
  readonly feedbackPlan: string;
  readonly criteria: readonly [string, string, string, string];
  readonly recommendedInstruments: readonly InstrumentKey[];
  readonly simulationNote: string;
};

export const sequences = [
  {
    key: "primaria",
    level: "Educación básica",
    grade: "5.º grado",
    subject: "Historia",
    title: "Cambios y permanencias en el acceso al agua",
    classDuration: 45,
    context:
      "Grupo con distintos ritmos de lectura. Para el laboratorio se simula que la misma secuencia fue aplicada en tres grupos anónimos con 50 estudiantes en total.",
    diagnosticStartingPoint:
      "El alumnado reconoce diferencias entre pasado y presente, pero todavía necesita distinguir un recuerdo personal de una afirmación respaldada por una fuente.",
    learningPurpose:
      "Comparar dos fuentes simuladas y explicar un cambio y una permanencia mediante fragmentos pertinentes.",
    contentAndProcesses: [
      "Orden temporal y comparación entre pasado y presente.",
      "Lectura de fuentes breves y selección de evidencia.",
      "Construcción de una explicación limitada a la información disponible.",
    ],
    sourceMaterial: `MATERIAL FICTICIO AULA-IA. No representa una comunidad real.

Fuente A · Aviso escolar simulado, 2001: “Los martes, las familias podrán recoger agua del depósito entre las siete y las nueve. Cada persona deberá llevar su recipiente”.

Fuente B · Testimonio simulado, 2026: “Ahora el agua llega al tanque de la escuela durante la semana. En temporada seca todavía organizamos turnos para cuidarla”.

Las fuentes permiten comparar una forma de acceso y una práctica de cuidado. No permiten calcular cuántas familias recibieron agua ni afirmar que el problema quedó resuelto.`,
    evidenceProduct:
      "Cuadro de cambio y permanencia, más una explicación individual de seis a ocho oraciones con un fragmento de apoyo.",
    moments: [
      {
        label: "Inicio",
        minutes: 8,
        teacherActions:
          "Presenta los encabezados, recupera ideas previas, comunica el propósito y modela una diferencia entre dato y suposición.",
        studentActions:
          "Observa, anticipa una diferencia y formula una pregunta sobre la información que falta.",
        evidence: "Hipótesis inicial y pregunta pendiente.",
      },
      {
        label: "Desarrollo",
        minutes: 27,
        teacherActions:
          "Ofrece lectura o audio, modela la selección de un fragmento y acompaña la comparación sin resolverla por el grupo.",
        studentActions:
          "Lee o escucha, subraya fragmentos, completa el cuadro y construye una explicación en pareja.",
        evidence: "Cuadro comparativo con fragmentos localizados.",
      },
      {
        label: "Cierre",
        minutes: 10,
        teacherActions:
          "Solicita una explicación individual y retroalimenta la relación entre afirmación y evidencia.",
        studentActions:
          "Redacta, revisa una generalización y registra una pregunta que las fuentes no resuelven.",
        evidence: "Explicación individual y boleto de salida.",
      },
    ],
    resources: [
      "Dos tarjetas de fuente ficticia.",
      "Versión en audio.",
      "Organizador cambio/permanencia.",
      "Glosario y frases de inicio.",
    ],
    inclusion: [
      "Lectura segmentada y alternativa de audio.",
      "Glosario visual y frases de apoyo sin reducir el propósito.",
      "Opción de explicar oralmente antes de redactar.",
    ],
    assessmentMoment:
      "Formativo: se usa el cuadro para orientar la explicación antes de cerrar el producto.",
    feedbackPlan:
      "Señalar un fragmento bien utilizado y pedir una revisión concreta de la afirmación que exceda la evidencia.",
    criteria: [
      "K1 · Selecciona información pertinente de las fuentes.",
      "K2 · Distingue un cambio y una permanencia.",
      "K3 · Relaciona cada afirmación con un fragmento de evidencia.",
      "K4 · Comunica y revisa una explicación comprensible.",
    ],
    recommendedInstruments: ["rubrica_analitica", "lista_cotejo"],
    simulationNote:
      "Secuencia, fuentes y resultados completamente ficticios para práctica docente.",
  },
  {
    key: "secundaria",
    level: "Secundaria",
    grade: "2.º grado",
    subject: "Formación cívica y ética",
    title: "¿Sombra o bebederos? Una decisión para el espacio escolar",
    classDuration: 50,
    context:
      "El grupo analizará un presupuesto y testimonios simulados. Para el laboratorio se usan tres grupos ficticios con 50 estudiantes en total.",
    diagnosticStartingPoint:
      "El alumnado expresa preferencias con facilidad, pero requiere apoyo para justificar una decisión pública con datos, consecuencias y alternativas.",
    learningPurpose:
      "Formular una recomendación viable y justificada a partir de una tabla de costos, alcance y mantenimiento, además de dos testimonios ficticios.",
    contentAndProcesses: [
      "Deliberación y toma de decisiones colectivas.",
      "Lectura de datos y testimonios.",
      "Construcción de argumentos y consideración de consecuencias.",
    ],
    sourceMaterial: `MATERIAL FICTICIO AULA-IA. No corresponde a una escuela real.

Presupuesto disponible: 100 unidades.
Opción A · Techo de sombra: costo inicial 70; beneficia el patio al mediodía; mantenimiento anual 12.
Opción B · Dos bebederos: costo inicial 60; acceso durante la jornada; mantenimiento anual 18.
Opción C · Solución escalonada: un bebedero y sombra móvil; costo inicial 95; requiere evaluar su uso durante un mes.

Voz 1: “En educación física evitamos el patio por el calor”.
Voz 2: “Algunas personas llevan poca agua y el bebedero actual falla”.

La información ayuda a comparar opciones, pero no incluye mediciones de temperatura, consumo ni costos futuros completos.`,
    evidenceProduct:
      "Nota de recomendación de 180 a 220 palabras que usa datos, considera una alternativa y declara una información faltante.",
    moments: [
      {
        label: "Inicio",
        minutes: 8,
        teacherActions:
          "Presenta el dilema y modela la diferencia entre preferencia personal y decisión fundamentada.",
        studentActions:
          "Registra una decisión inicial y una razón provisional.",
        evidence: "Decisión inicial con una razón.",
      },
      {
        label: "Desarrollo",
        minutes: 32,
        teacherActions:
          "Guía la lectura de la tabla, solicita comparar consecuencias y plantea una objeción para cada opción.",
        studentActions:
          "Analiza datos y testimonios, compara alternativas y redacta una recomendación.",
        evidence: "Matriz de alternativas y primer borrador.",
      },
      {
        label: "Cierre",
        minutes: 10,
        teacherActions:
          "Organiza el intercambio y pide ajustar la decisión con base en una objeción pertinente.",
        studentActions:
          "Revisa el texto y explica qué dato adicional necesitaría.",
        evidence: "Recomendación final y dato faltante.",
      },
    ],
    resources: [
      "Tabla ficticia de alternativas.",
      "Dos testimonios simulados.",
      "Organizador decisión/evidencia/consecuencia.",
      "Plantilla argumentativa opcional.",
    ],
    inclusion: [
      "Tabla con etiquetas e iconos además de color.",
      "Lectura en voz alta y tiempo de anticipación.",
      "Alternativa oral grabada con la misma exigencia argumentativa.",
    ],
    assessmentMoment:
      "Formativo: la objeción de un par se utiliza para revisar la recomendación.",
    feedbackPlan:
      "Reconocer el dato mejor conectado y solicitar una consecuencia o límite que todavía no esté considerado.",
    criteria: [
      "K1 · Define el problema de decisión.",
      "K2 · Usa datos o testimonios pertinentes.",
      "K3 · Considera consecuencias y una alternativa.",
      "K4 · Propone una acción viable y justificada.",
    ],
    recommendedInstruments: ["escala_valoracion", "guia_observacion"],
    simulationNote:
      "Escenario, presupuesto, voces y resultados completamente ficticios.",
  },
  {
    key: "media-superior",
    level: "Educación media superior",
    grade: "Bachillerato",
    subject: "Filosofía",
    title: "¿Retroalimentación de IA sin revisión docente?",
    classDuration: 55,
    context:
      "Discusión argumentada con materiales simulados. Para el laboratorio se representa la aplicación en tres grupos ficticios con 50 estudiantes.",
    diagnosticStartingPoint:
      "Las personas participantes identifican una opinión, pero necesitan distinguir tesis, evidencia, inferencia, supuesto y objeción.",
    learningPurpose:
      "Construir una posición condicional sobre el uso de retroalimentación de IA, sustentada en evidencia y abierta a revisión.",
    contentAndProcesses: [
      "Estructura de argumentos y objeciones.",
      "Diferencia entre evidencia, inferencia y supuesto.",
      "Deliberación ética y decisiones condicionadas.",
    ],
    sourceMaterial: `MATERIAL FICTICIO AULA-IA. No informa sobre un estudio real.

Piloto simulado con 40 textos: 28 sugerencias pertinentes, 8 comentarios genéricos y 4 sugerencias incompatibles con los criterios comunicados.

Voz estudiantil simulada: “La respuesta llegó rápido, pero no entendí cuál comentario era prioritario”.
Voz docente simulada: “Al revisar los mensajes encontré recomendaciones útiles y otras que necesitaban contexto”.

Los datos describen este ejercicio ficticio. No permiten generalizar a todas las herramientas, materias o instituciones.`,
    evidenceProduct:
      "Texto argumentativo de 250 a 300 palabras con tesis, dos evidencias, una objeción y una decisión condicionada.",
    moments: [
      {
        label: "Inicio",
        minutes: 10,
        teacherActions:
          "Presenta el dilema, solicita una postura inicial y explicita los conceptos que se observarán.",
        studentActions:
          "Formula una posición preliminar y localiza el conflicto ético.",
        evidence: "Tesis inicial y condición provisional.",
      },
      {
        label: "Desarrollo",
        minutes: 35,
        teacherActions:
          "Modela evidencia frente a inferencia, distribuye una objeción y cuestiona generalizaciones.",
        studentActions:
          "Analiza datos y voces, construye un argumento, responde la objeción y redacta.",
        evidence: "Matriz argumentativa y borrador.",
      },
      {
        label: "Cierre",
        minutes: 10,
        teacherActions:
          "Facilita contraste entre pares y solicita revisar la condición que limita la tesis.",
        studentActions:
          "Defiende brevemente su posición y entrega una versión ajustada.",
        evidence: "Texto final y justificación del ajuste.",
      },
    ],
    resources: [
      "Tabla ficticia del piloto.",
      "Dos voces simuladas.",
      "Organizador tesis/evidencia/objeción/condición.",
      "Respuesta de contingencia sin IA.",
    ],
    inclusion: [
      "Lectura segmentada y organizador anticipado.",
      "Opción de defensa oral o escrita.",
      "Ejemplos de conectores sin predeterminar la postura.",
    ],
    assessmentMoment:
      "Formativo: el contraste entre pares permite revisar tesis, objeción y condición.",
    feedbackPlan:
      "Citar la evidencia mejor integrada y solicitar que se explicite un límite o una condición de uso.",
    criteria: [
      "K1 · Formula con precisión el problema y la tesis.",
      "K2 · Relaciona evidencias y razones señalando límites.",
      "K3 · Examina una objeción relevante.",
      "K4 · Propone una decisión condicionada y revisable.",
    ],
    recommendedInstruments: ["rubrica_analitica", "guia_observacion"],
    simulationNote:
      "Piloto, textos, voces y resultados completamente ficticios.",
  },
  {
    key: "superior",
    level: "Educación superior",
    grade: "Licenciatura",
    subject: "Humanidades",
    title: "Tres interpretaciones de la interrupción de estudios",
    classDuration: 75,
    context:
      "Seminario con lectura previa y escritura académica breve. La práctica usa tres grupos ficticios con 50 estudiantes.",
    diagnosticStartingPoint:
      "El grupo puede resumir fuentes, pero requiere profundizar en el contraste de explicaciones y evitar convertir asociaciones en causas.",
    learningPurpose:
      "Comparar explicaciones rivales, valorar sus límites y construir una interpretación provisional con una pregunta de investigación.",
    contentAndProcesses: [
      "Contraste y trazabilidad de fuentes.",
      "Asociación, explicación y límites causales.",
      "Síntesis académica y formulación de preguntas investigables.",
    ],
    sourceMaterial: `MATERIAL FICTICIO AULA-IA. No corresponde a una institución ni investigación real.

Cohorte simulada: 120 ingresos y 18 interrupciones. Entre esos 18 casos, 11 registran empleo de más de 20 horas semanales, 9 un traslado superior a 60 minutos y 4 al menos una visita de apoyo académico.

Entrevista A simulada: “El horario laboral cambió y dejé de asistir a dos materias”.
Entrevista B simulada: “El trayecto y los costos se acumularon, pero también me costó pedir apoyo”.
Nota institucional simulada: “Los registros disponibles no contienen información completa sobre cuidado familiar, salud o conectividad”.

Las coincidencias no prueban causalidad ni permiten jerarquizar por sí solas las explicaciones.`,
    evidenceProduct:
      "Matriz de fuentes y memo analítico de 300 a 400 palabras con interpretación provisional, límites e interrogante pendiente.",
    moments: [
      {
        label: "Inicio",
        minutes: 12,
        teacherActions:
          "Recupera hipótesis, distingue asociación de causa y comunica criterios de trazabilidad.",
        studentActions:
          "Formula una hipótesis provisional y anticipa qué evidencia sería necesaria.",
        evidence: "Hipótesis y necesidad de información.",
      },
      {
        label: "Desarrollo",
        minutes: 48,
        teacherActions:
          "Acompaña el contraste de tabla, entrevistas y nota; pregunta qué sostiene y qué limita cada explicación.",
        studentActions:
          "Completa la matriz, compara tres interpretaciones y redacta una síntesis provisional.",
        evidence: "Matriz de trazabilidad y borrador de memo.",
      },
      {
        label: "Cierre",
        minutes: 15,
        teacherActions:
          "Organiza revisión breve y solicita una implicación práctica prudente y una pregunta investigable.",
        studentActions:
          "Revisa el memo, delimita su afirmación y formula una pregunta de seguimiento.",
        evidence: "Memo final, límite e interrogante.",
      },
    ],
    resources: [
      "Tabla ficticia de cohorte.",
      "Entrevistas y nota institucional simuladas.",
      "Matriz de trazabilidad.",
      "Guía para distinguir hallazgo, inferencia y pregunta.",
    ],
    inclusion: [
      "Material anticipado y versión tabular accesible.",
      "Distribución de roles para lectura y contraste.",
      "Alternativa oral equivalente al memo cuando corresponda.",
    ],
    assessmentMoment:
      "Formativo: la matriz y la revisión entre pares preceden a la síntesis final.",
    feedbackPlan:
      "Reconocer una relación bien trazada y solicitar que se delimite cualquier afirmación causal no respaldada.",
    criteria: [
      "K1 · Formula una interpretación delimitada.",
      "K2 · Integra fuentes con trazabilidad.",
      "K3 · Contrasta explicaciones y reconoce límites.",
      "K4 · Deriva una implicación y una pregunta investigable.",
    ],
    recommendedInstruments: ["portafolio_evidencias", "rubrica_analitica"],
    simulationNote:
      "Cohorte, fuentes, testimonios y resultados completamente ficticios.",
  },
] as const satisfies readonly SessionFiveSequence[];

export const defaultSequence = sequences[2];

export type InstrumentDefinition = {
  readonly key: InstrumentKey;
  readonly label: string;
  readonly purpose: string;
  readonly bestFor: string;
  readonly minimumStructure: readonly string[];
  readonly risk: string;
  readonly dashboardTreatment: string;
};

export const instrumentTypes = [
  {
    key: "rubrica_analitica",
    label: "Rúbrica analítica",
    purpose: "Describir por separado la calidad observable de varias dimensiones.",
    bestFor: "Productos complejos que admiten más de un criterio y distintos niveles de desempeño.",
    minimumStructure: [
      "Tres o cuatro criterios alineados con el propósito.",
      "Cuatro niveles paralelos con descriptores observables.",
      "Espacio para evidencia localizada y comentario.",
    ],
    risk: "Usar adjetivos vagos o producir una precisión numérica que la evidencia no sostiene.",
    dashboardTreatment: "Conservar valores 1–4 y mostrar distribución, promedio y denominador.",
  },
  {
    key: "lista_cotejo",
    label: "Lista de cotejo",
    purpose: "Registrar presencia, ausencia o falta de evidencia de elementos observables.",
    bestFor: "Pasos, requisitos o componentes claramente delimitados.",
    minimumStructure: [
      "Indicadores independientes y observables.",
      "Valores Sí, Aún no y No observable.",
      "Espacio para localizar evidencia y proponer siguiente acción.",
    ],
    risk: "Confundir la presencia de un elemento con la calidad de su realización.",
    dashboardTreatment: "Explicitar cualquier conversión; 3–4 puede mapearse a Sí y 1–2 a Aún no, con pérdida de detalle.",
  },
  {
    key: "escala_valoracion",
    label: "Escala de valoración",
    purpose: "Registrar grado, frecuencia o consistencia de un desempeño.",
    bestFor: "Comportamientos que pueden observarse en distintos grados sin requerir una rúbrica extensa.",
    minimumStructure: [
      "Una dimensión observable por fila.",
      "Anclas 1–4 con el mismo atributo en todos los niveles.",
      "Ejemplo o nota que permita justificar el valor.",
    ],
    risk: "Mezclar frecuencia, calidad y autonomía en una misma escala sin aclararlo.",
    dashboardTreatment: "Usar valores 1–4 y declarar qué significa cada ancla.",
  },
  {
    key: "guia_observacion",
    label: "Guía de observación",
    purpose: "Documentar procesos, interacciones y desempeños mientras ocurren.",
    bestFor: "Discusión, colaboración, exposición, procedimiento o desempeño situado.",
    minimumStructure: [
      "Propósito y momento de observación.",
      "Indicadores y registro descriptivo.",
      "Pregunta de seguimiento y límite de la observación.",
    ],
    risk: "Convertir una observación parcial en una afirmación general sobre la persona.",
    dashboardTreatment: "Normalizar solo indicadores comparables y conservar notas descriptivas fuera del promedio.",
  },
  {
    key: "portafolio_evidencias",
    label: "Portafolio de evidencias",
    purpose: "Analizar progreso, revisión y decisiones a través de varias evidencias relacionadas.",
    bestFor: "Procesos prolongados, proyectos y productos que cambian después de la retroalimentación.",
    minimumStructure: [
      "Piezas requeridas y criterio de selección.",
      "Retroalimentación recibida y revisión realizada.",
      "Reflexión final y evidencia de progreso.",
    ],
    risk: "Acumular archivos sin mostrar relación, selección razonada ni progreso.",
    dashboardTreatment: "Resumir cumplimiento y progreso sin sustituir la lectura de las piezas del portafolio.",
  },
] as const satisfies readonly InstrumentDefinition[];

export const instruments = instrumentTypes;

export const difficultyLevels = [
  {
    key: "basico",
    label: "Básico",
    description: "Construye un instrumento congruente con la secuencia y la evidencia observable.",
    requirement: "Responde 3 preguntas esenciales para construir el instrumento congruente.",
  },
  {
    key: "intermedio",
    label: "Intermedio",
    description: "Conserva las 3 preguntas básicas y agrega precisión sobre valores, aplicación y lectura inicial.",
    requirement: "Responde 6 preguntas: las 3 básicas y 3 nuevas.",
  },
  {
    key: "avanzado",
    label: "Avanzado",
    description: "Conserva las 6 preguntas anteriores y añade triangulación, límites de datos y verificación de la decisión docente.",
    requirement: "Responde 10 preguntas: las 6 intermedias y 4 nuevas.",
  },
] as const;

const basicRequirements = [
  "Identifica la secuencia y la evidencia observable que se evaluará.",
  "Elige un instrumento congruente con el producto o desempeño.",
  "Define al menos tres criterios observables alineados con el propósito.",
] as const;

const intermediateRequirements = [
  ...basicRequirements,
  "Define anclas, valores o niveles inequívocos.",
  "Explica cómo se aplicará el instrumento y cómo se registrará la evidencia.",
  "Propone una lectura inicial con denominador explícito, sin atribuir causas.",
] as const;

const advancedRequirements = [
  ...intermediateRequirements,
  "Añade un instrumento complementario y explica qué aporta la triangulación.",
  "Declara datos faltantes, calidad y límites de la lectura.",
  "Justifica si acepta, adapta o rechaza el borrador de IA.",
  "Formula una decisión docente y la nueva evidencia que permitirá verificarla.",
] as const;

export const difficultyPromptRequirements = {
  basico: basicRequirements,
  intermedio: intermediateRequirements,
  avanzado: advancedRequirements,
} as const;

const basicChecklist = [
  "La secuencia y su evidencia observable están identificadas.",
  "El instrumento corresponde al producto o desempeño.",
  "El instrumento incluye al menos tres criterios observables alineados con el propósito.",
] as const;

const intermediateChecklist = [
  ...basicChecklist,
  "Las anclas, valores o niveles son inequívocos.",
  "Se explica cómo aplicar el instrumento y registrar la evidencia.",
  "La lectura inicial declara el denominador y no atribuye causas.",
] as const;

const advancedChecklist = [
  ...intermediateChecklist,
  "Se incorpora un instrumento complementario y se explica el aporte de la triangulación.",
  "Se declaran los datos faltantes, la calidad y los límites de la lectura.",
  "Se justifica aceptar, adaptar o rechazar el borrador de IA.",
  "La decisión docente incluye una nueva evidencia para verificarla.",
] as const;

export const difficultyEvidenceChecklist = {
  basico: basicChecklist,
  intermedio: intermediateChecklist,
  avanzado: advancedChecklist,
} as const;

export const difficultyContent = {
  basico: {
    description: "Construye un instrumento congruente con 3 preguntas esenciales.",
    requirement: difficultyLevels[0].requirement,
    finalInstruction:
      "Ruta Básica: responde las 3 preguntas esenciales. La privacidad, el uso de datos ficticios y la decisión humana son requisitos transversales.",
  },
  intermedio: {
    description: "Agrega precisión sobre valores, aplicación y lectura inicial: 6 preguntas en total.",
    requirement: difficultyLevels[1].requirement,
    finalInstruction:
      "Ruta Intermedia: responde las 3 preguntas básicas y 3 nuevas; no es necesario realizar la ruta avanzada.",
  },
  avanzado: {
    description: "Añade triangulación, límites de datos y verificación de la decisión docente: 10 preguntas en total.",
    requirement: difficultyLevels[2].requirement,
    finalInstruction:
      "Ruta Avanzada: responde las 6 preguntas intermedias y 4 nuevas, con revisión explícita del borrador de IA.",
  },
} as const;

export type CriterionKey = "k1" | "k2" | "k3" | "k4";
export type CriterionScore = 1 | 2 | 3 | 4 | null;
export type PerformanceLevel =
  | "Inicial"
  | "En desarrollo"
  | "Logrado"
  | "Destacado"
  | "Sin evidencia";

export type StudentResult = {
  readonly id: string;
  readonly group: SessionFiveGroup;
  readonly k1: CriterionScore;
  readonly k2: CriterionScore;
  readonly k3: CriterionScore;
  readonly k4: CriterionScore;
  readonly submitted: boolean;
  readonly level: PerformanceLevel;
};

export const criterionKeys = ["k1", "k2", "k3", "k4"] as const;

export const scoreAnchors = [
  { score: 1, label: "Inicial", description: "La evidencia todavía no muestra el desempeño esperado." },
  { score: 2, label: "En desarrollo", description: "La evidencia muestra avances parciales o requiere apoyo frecuente." },
  { score: 3, label: "Logrado", description: "La evidencia muestra el desempeño esperado de manera suficiente." },
  { score: 4, label: "Destacado", description: "La evidencia muestra el desempeño, sus límites y una revisión autónoma." },
] as const;

type ScoreTuple = readonly [number, number, number, number];

const scoresByGroup: Record<
  SessionFiveGroup,
  readonly (ScoreTuple | null)[]
> = {
  G1: [
    [4, 4, 3, 4], [3, 4, 3, 3], [4, 3, 4, 4], [3, 3, 3, 3],
    [4, 4, 4, 4], [3, 3, 2, 3], [4, 3, 3, 4], [3, 4, 4, 3],
    [2, 3, 3, 3], [4, 4, 3, 3], [3, 3, 4, 3], [4, 3, 4, 3],
    [3, 4, 3, 4], [2, 3, 2, 3], [3, 3, 3, 4], [4, 4, 4, 3],
    [3, 2, 3, 3],
  ],
  G2: [
    [3, 3, 3, 3], [3, 2, 3, 3], [2, 3, 2, 3], [3, 3, 2, 2],
    [4, 3, 3, 3], [2, 2, 3, 2], [3, 3, 3, 2], [2, 3, 3, 3],
    [3, 2, 2, 3], [4, 4, 3, 3], [2, 2, 2, 2], [3, 3, 4, 3],
    [3, 2, 3, 2], [2, 3, 2, 2], [3, 3, 3, 4], [2, 2, 3, 3],
    null,
  ],
  G3: [
    [2, 2, 2, 3], [3, 2, 2, 2], [2, 3, 2, 2], [1, 2, 2, 2],
    [3, 3, 2, 3], [2, 2, 3, 2], [1, 2, 1, 2], [3, 2, 3, 3],
    [2, 2, 2, 2], [2, 3, 3, 2], [1, 1, 2, 2], [3, 3, 3, 3],
    [2, 1, 2, 2], [2, 2, 3, 3], [1, 2, 2, 1], null,
  ],
};

export function performanceLevelForAverage(
  average: number | null,
): PerformanceLevel {
  if (average === null) return "Sin evidencia";
  if (average >= 3.5) return "Destacado";
  if (average >= 2.75) return "Logrado";
  if (average >= 2) return "En desarrollo";
  return "Inicial";
}

export function averageResult(
  result: Pick<StudentResult, CriterionKey>,
): number | null {
  const values = criterionKeys
    .map((key) => result[key])
    .filter((value): value is Exclude<CriterionScore, null> => value !== null);

  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export const studentResults: readonly StudentResult[] = (
  ["G1", "G2", "G3"] as const
).flatMap((group) =>
  scoresByGroup[group].map((scores, index) => {
    const values = scores ?? [null, null, null, null];
    const submitted = scores !== null;
    const average = submitted
      ? scores.reduce((sum, value) => sum + value, 0) / scores.length
      : null;

    return {
      id: `${group}-${String(index + 1).padStart(2, "0")}`,
      group,
      k1: values[0] as CriterionScore,
      k2: values[1] as CriterionScore,
      k3: values[2] as CriterionScore,
      k4: values[3] as CriterionScore,
      submitted,
      level: performanceLevelForAverage(average),
    };
  }),
);

export type LevelDistribution = Record<PerformanceLevel, number>;

export type GroupMetric = {
  readonly total: number;
  readonly submitted: number;
  readonly participationRate: number;
  readonly average: number | null;
};

export type SessionFiveMetrics = {
  readonly total: number;
  readonly submitted: number;
  readonly participationRate: number;
  readonly overallAverage: number | null;
  readonly criterionAverages: Record<CriterionKey, number | null>;
  readonly criterionCounts: Record<CriterionKey, number>;
  readonly groups: Record<SessionFiveGroup, GroupMetric>;
  readonly distribution: LevelDistribution;
  readonly lowestCriterion: CriterionKey | null;
  readonly highestGroup: SessionFiveGroup | null;
  readonly lowestGroup: SessionFiveGroup | null;
  readonly groupGap: number | null;
};

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function emptyDistribution(): LevelDistribution {
  return {
    Inicial: 0,
    "En desarrollo": 0,
    Logrado: 0,
    Destacado: 0,
    "Sin evidencia": 0,
  };
}

export function computeSessionFiveMetrics(
  results: readonly StudentResult[] = studentResults,
): SessionFiveMetrics {
  const submitted = results.filter((result) => result.submitted);
  const criterionAverages = {} as Record<CriterionKey, number | null>;
  const criterionCounts = {} as Record<CriterionKey, number>;

  for (const key of criterionKeys) {
    const values = results
      .map((result) => result[key])
      .filter((value): value is Exclude<CriterionScore, null> => value !== null);
    criterionCounts[key] = values.length;
    criterionAverages[key] = values.length
      ? round(values.reduce((sum, value) => sum + value, 0) / values.length)
      : null;
  }

  const submittedAverages = submitted
    .map(averageResult)
    .filter((value): value is number => value !== null);

  const groups = {} as Record<SessionFiveGroup, GroupMetric>;
  for (const group of ["G1", "G2", "G3"] as const) {
    const groupResults = results.filter((result) => result.group === group);
    const groupSubmitted = groupResults.filter((result) => result.submitted);
    const averages = groupSubmitted
      .map(averageResult)
      .filter((value): value is number => value !== null);
    groups[group] = {
      total: groupResults.length,
      submitted: groupSubmitted.length,
      participationRate: groupResults.length
        ? round((groupSubmitted.length / groupResults.length) * 100)
        : 0,
      average: averages.length
        ? round(averages.reduce((sum, value) => sum + value, 0) / averages.length)
        : null,
    };
  }

  const distribution = emptyDistribution();
  for (const result of results) distribution[result.level] += 1;

  const availableCriteria = criterionKeys.filter(
    (key) => criterionAverages[key] !== null,
  );
  const lowestCriterion = availableCriteria.length
    ? availableCriteria.reduce((lowest, key) =>
        (criterionAverages[key] ?? Number.POSITIVE_INFINITY) <
        (criterionAverages[lowest] ?? Number.POSITIVE_INFINITY)
          ? key
          : lowest,
      )
    : null;

  const availableGroups = (["G1", "G2", "G3"] as const).filter(
    (group) => groups[group].average !== null,
  );
  const highestGroup = availableGroups.length
    ? availableGroups.reduce((highest, group) =>
        (groups[group].average ?? Number.NEGATIVE_INFINITY) >
        (groups[highest].average ?? Number.NEGATIVE_INFINITY)
          ? group
          : highest,
      )
    : null;
  const lowestGroup = availableGroups.length
    ? availableGroups.reduce((lowest, group) =>
        (groups[group].average ?? Number.POSITIVE_INFINITY) <
        (groups[lowest].average ?? Number.POSITIVE_INFINITY)
          ? group
          : lowest,
      )
    : null;
  const groupGap =
    highestGroup && lowestGroup
      ? round(
          (groups[highestGroup].average ?? 0) -
            (groups[lowestGroup].average ?? 0),
        )
      : null;

  return {
    total: results.length,
    submitted: submitted.length,
    participationRate: results.length
      ? round((submitted.length / results.length) * 100)
      : 0,
    overallAverage: submittedAverages.length
      ? round(
          submittedAverages.reduce((sum, value) => sum + value, 0) /
            submittedAverages.length,
        )
      : null,
    criterionAverages,
    criterionCounts,
    groups,
    distribution,
    lowestCriterion,
    highestGroup,
    lowestGroup,
    groupGap,
  };
}

export const calculateSessionFiveMetrics = computeSessionFiveMetrics;
export const expectedDashboardMetrics = computeSessionFiveMetrics();

export const dashboardInterpretationGuide = {
  observableFinding:
    "K1 presenta el promedio más bajo. G1, G2 y G3 muestran resultados diferentes y existen dos registros sin evidencia.",
  unsupportedClaim:
    "Los datos no permiten afirmar que un grupo tenga menor capacidad ni explicar por sí solos la causa de la diferencia.",
  pendingQuestions: [
    "¿Las condiciones de aplicación y el acceso a los materiales fueron equivalentes?",
    "¿Los criterios se interpretaron de la misma manera en los tres grupos?",
    "¿Qué muestran las evidencias originales de K1 que el promedio no conserva?",
  ],
  suggestedDecision:
    "Modelar K1 con un ejemplo resuelto, ofrecer práctica guiada y recopilar una evidencia breve de seguimiento antes de una decisión definitiva.",
} as const;

export const dashboardReviewScenarios = [
  {
    text: "La entrega fue de 96 %, por lo tanto el aprendizaje mejoró.",
    answer: "rechazar",
    feedback:
      "La entrega describe participación, no demuestra mejora sin una comparación válida del aprendizaje.",
  },
  {
    text: "G3 obtuvo un promedio menor; eso prueba que sus estudiantes tienen menor capacidad.",
    answer: "rechazar",
    feedback:
      "El promedio no explica causas ni autoriza etiquetas sobre las personas.",
  },
  {
    text: "K1 es el criterio con menor promedio; conviene revisar evidencias, reenseñar y volver a observarlo.",
    answer: "conservar",
    feedback:
      "La propuesta vincula un hallazgo observable con una acción verificable sin inventar una causa.",
  },
  {
    text: "Se excluyeron dos registros faltantes y se declaró el denominador de 48 evidencias.",
    answer: "conservar",
    feedback:
      "Declarar faltantes y denominadores permite interpretar el resumen con mayor precisión.",
  },
  {
    text: "La IA recomienda asignar la calificación final usando el promedio de cada grupo.",
    answer: "retirar",
    feedback:
      "Un promedio grupal no sustituye la evidencia individual, los criterios institucionales ni la decisión docente.",
  },
] as const;

export type PrepCriterionValue = 0 | 1 | null;

export type PrepStudentResult = {
  readonly id: string;
  readonly k1: PrepCriterionValue;
  readonly k2: PrepCriterionValue;
  readonly k3: PrepCriterionValue;
  readonly k4: PrepCriterionValue;
  readonly submitted: boolean;
};

export const prepScenario = {
  title: "Explicar una idea central con dos datos",
  level: "Preparación · 1.º de secundaria",
  subject: "Lengua",
  context:
    "Después de leer un texto ficticio sobre huertos comunitarios, el alumnado escribe un párrafo de 100 palabras.",
  learningPurpose:
    "Identificar la idea central y explicar cómo dos datos del texto la respaldan.",
  evidenceProduct: "Párrafo explicativo de aproximadamente 100 palabras.",
  simulationNote:
    "Caso y ocho resultados completamente ficticios; no describen estudiantes reales.",
} as const;

export const prepContext = prepScenario;

export const prepChecklist = [
  "K1 · Identifica correctamente la idea central.",
  "K2 · Incorpora dos datos pertinentes del texto.",
  "K3 · Explica cómo los datos apoyan la idea central.",
  "K4 · Revisa la claridad de su párrafo.",
] as const;

export const prepStudentResults: readonly PrepStudentResult[] = [
  { id: "P-01", k1: 1, k2: 1, k3: 1, k4: 1, submitted: true },
  { id: "P-02", k1: 1, k2: 1, k3: 0, k4: 1, submitted: true },
  { id: "P-03", k1: 1, k2: 0, k3: 1, k4: 1, submitted: true },
  { id: "P-04", k1: 1, k2: 0, k3: 0, k4: 1, submitted: true },
  { id: "P-05", k1: 1, k2: 1, k3: 1, k4: 0, submitted: true },
  { id: "P-06", k1: 0, k2: 1, k3: 0, k4: 1, submitted: true },
  { id: "P-07", k1: 1, k2: 1, k3: 1, k4: 1, submitted: true },
  { id: "P-08", k1: null, k2: null, k3: null, k4: null, submitted: false },
];

export const prepDataset = prepStudentResults;

export function computePrepMetrics(
  results: readonly PrepStudentResult[] = prepStudentResults,
) {
  const submitted = results.filter((result) => result.submitted);
  const achieved = {} as Record<CriterionKey, number>;
  const observable = {} as Record<CriterionKey, number>;
  for (const key of criterionKeys) {
    const values = results
      .map((result) => result[key])
      .filter((value): value is Exclude<PrepCriterionValue, null> => value !== null);
    observable[key] = values.length;
    achieved[key] = values.filter((value) => value === 1).length;
  }
  return {
    total: results.length,
    submitted: submitted.length,
    participationRate: results.length
      ? round((submitted.length / results.length) * 100)
      : 0,
    achieved,
    observable,
    priorityCriterion: "k3" as const,
  };
}

export const expectedPrepMetrics = computePrepMetrics();

export const prepInterpretation =
  "Siete de ocho evidencias fueron entregadas. K3 aparece en cuatro de siete: conviene modelar cómo explicar la relación entre dato e idea, ofrecer una práctica breve y volver a observar el mismo indicador.";

export function buildInstrumentPrompt(
  sequence: SessionFiveSequence,
  instrument: InstrumentDefinition,
  difficulty: DifficultyKey,
): string {
  const requirements = difficultyPromptRequirements[difficulty]
    .map((requirement, index) => `${index + 1}. ${requirement}`)
    .join("\n");

  return `Actúa como asistente de diseño de instrumentos. Produce un BORRADOR que una persona docente revisará antes de utilizar.

AVISO
Trabaja únicamente con el caso ficticio incluido. No inventes nombres, diagnósticos, calificaciones ni información del alumnado.

SECUENCIA
Nivel: ${sequence.level} · ${sequence.grade}
Asignatura: ${sequence.subject}
Título: ${sequence.title}
Propósito: ${sequence.learningPurpose}
Evidencia: ${sequence.evidenceProduct}

INSTRUMENTO SOLICITADO
${instrument.label}
Uso previsto: ${instrument.bestFor}
Riesgo que debes evitar: ${instrument.risk}

CRITERIOS DE REFERENCIA
${sequence.criteria.join("\n")}

RUTA ${difficulty.toUpperCase()}
${requirements}

ENCARGO
1. Construye el instrumento con criterios observables y lenguaje respetuoso.
2. Explica cómo aplicarlo y qué dato no permite obtener.
3. Incluye una opción de acceso o expresión sin reducir el propósito.
4. Propón dos inicios de retroalimentación basados en evidencia.
5. No asignes una calificación final ni sustituyas la decisión docente.

FORMATO
Instrumento en tabla; protocolo de aplicación; límites; opción de acceso; retroalimentación inicial; preguntas para revisión docente.`;
}

export function buildAnalysisPrompt(
  sequence: SessionFiveSequence,
  instrument: InstrumentDefinition,
): string {
  return `Actúa como asistente de análisis educativo. Analiza únicamente los 50 registros FICTICIOS de AULA-IA.

CONTEXTO
Secuencia: ${sequence.title}
Nivel: ${sequence.level}
Instrumento: ${instrument.label}
Los campos K1–K4 corresponden, en ese orden, a estos criterios:
${sequence.criteria.join("\n")}

REGLAS
- Declara el número total, el número de evidencias y todos los denominadores.
- Trata los valores vacíos como datos faltantes; no los conviertas en cero.
- Separa hallazgo observable, interpretación provisional y pregunta pendiente.
- Compara grupos y criterios sin atribuir causas ni etiquetar personas.
- Si se usa una lista de cotejo, declara cualquier conversión y la pérdida de información.
- No asignes calificaciones finales ni inventes datos.

SALIDA
1. Calidad y faltantes del conjunto.
2. Tres indicadores generales.
3. Comparación de G1, G2 y G3.
4. Criterio que requiere revisión y evidencia que debe consultarse.
5. Dos acciones docentes.
6. Una evidencia de seguimiento.
7. Límites del análisis.
8. Recomendación final marcada como BORRADOR para aceptar, adaptar o rechazar.`;
}

export const analysisPrompt = buildAnalysisPrompt(
  defaultSequence,
  instruments[0],
);

export const instrumentContingency = `BORRADOR DE CONTINGENCIA AULA-IA · DATOS FICTICIOS

Caso: Educación media superior · ¿Retroalimentación de IA sin revisión docente?
Instrumento: rúbrica analítica de cuatro criterios y cuatro niveles.

K1 · Problema y tesis
4: Formula una tesis precisa, condicionada y vinculada con el dilema.
3: Formula una tesis clara que responde al dilema.
2: Expresa una posición, pero el problema o la condición permanecen vagos.
1: Presenta una opinión sin tesis delimitada.

K2 · Evidencias y razones
4: Integra dos evidencias, explica su relación y señala límites.
3: Usa dos evidencias pertinentes y las relaciona con la tesis.
2: Menciona una evidencia con relación parcial o implícita.
1: Afirma sin apoyo o atribuye a la fuente algo que no contiene.

K3 · Objeción
4: Formula una objeción relevante, responde y reconoce una condición o límite.
3: Reconoce y responde una objeción pertinente.
2: Menciona una postura contraria sin examinarla.
1: Omite o distorsiona la objeción.

K4 · Decisión y revisión
4: Propone una acción viable, condicionada, con seguimiento, y revisa su texto.
3: Propone una acción justificada y un siguiente paso.
2: Propone una acción general con relación débil con la evidencia.
1: No formula una decisión viable.

Protocolo: leer el producto completo, localizar evidencia para cada criterio, asignar un nivel provisional, escribir una nota breve y revisar cualquier discrepancia antes de comunicar resultados.

Límites: la rúbrica no demuestra causas, no sustituye la lectura del producto y no autoriza una calificación automática.`;

export const contingencyInstrument = instrumentContingency;

export const analysisContingency = `BORRADOR DE CONTINGENCIA AULA-IA · ANÁLISIS DE 50 REGISTROS FICTICIOS

Calidad de datos: 50 registros; 48 con evidencia y 2 faltantes. La participación es 96 %. Los faltantes no se convierten en cero.

Hallazgos: promedio general 2.76 de 4. K1 = 2.71; K2 = 2.75; K3 = 2.77; K4 = 2.79. G1 = 3.31; G2 = 2.72; G3 = 2.17. La diferencia G1–G3 es 1.14 puntos.

Distribución: Inicial 5; En desarrollo 16; Logrado 17; Destacado 10; Sin evidencia 2.

Interpretación provisional: K1 requiere revisión y G3 podría necesitar apoyo adicional. Los resultados no explican por qué existe la diferencia ni permiten etiquetar a las personas.

Decisión sugerida: revisar evidencias originales de K1, modelar un ejemplo, ofrecer práctica guiada y recoger una nueva evidencia breve.

Revisión humana: aceptar el hallazgo descriptivo; adaptar la recomendación después de comprobar condiciones de aplicación; rechazar cualquier conclusión causal o calificación automática.`;

export const prepContingency = `BORRADOR DE CONTINGENCIA AULA-IA · PREPARACIÓN

Lista de cotejo: idea central; dos datos pertinentes; explicación de la relación; revisión de claridad.

Resultados ficticios: siete de ocho entregas. K1: 6/7; K2: 5/7; K3: 4/7; K4: 6/7.

Hallazgo: K3 es el indicador menos observado.
Decisión: modelar cómo explicar la relación entre un dato y la idea central, practicar con un ejemplo y volver a observar K3.
Límite: estos datos no permiten afirmar que el grupo no sabe escribir ni explicar la causa del resultado.`;

export const sourceLinks = [
  {
    label: "SEP · Seguimiento y evaluación a la planeación didáctica",
    url: "https://educacionbasica.sep.gob.mx/wp-content/uploads/2024/06/Lenguajes_Seguimiento-y-evaluacion-a-la-Planeacion-Didactica-.pdf",
    support:
      "Ofrece referentes de educación básica para vincular contexto, contenidos, procesos de aprendizaje, actividades y evaluación formativa.",
  },
  {
    label: "DGB-SEP · Orientaciones de planeación didáctica para el MCCEMS",
    url: "https://dgb.sep.gob.mx/storage/recursos/2023/08/u76hbQe4LW-Orientaciones-de-Planeacion-Didactica.pdf",
    support:
      "Relaciona progresiones, metas de aprendizaje, contexto, autonomía docente y decisiones de planeación en educación media superior.",
  },
  {
    label: "SEP · La evaluación formativa como reto pedagógico-didáctico",
    url: "https://educacionbasica.sep.gob.mx/wp-content/uploads/2024/07/2324_s81_La_evaluacion_formativa_reto_pedagogico_didactico.pdf",
    support:
      "Relaciona evidencia, diálogo, retroalimentación y ajustes de enseñanza y aprendizaje.",
  },
  {
    label: "UNESCO · Marco de competencias de IA para docentes",
    url: "https://www.unesco.org/en/articles/ai-competency-framework-teachers?hub=195885",
    support:
      "Sustenta una integración de IA centrada en agencia, responsabilidad y desarrollo profesional docente.",
  },
  {
    label: "UNESCO · Guía para IA generativa en educación e investigación",
    url: "https://unesdoc.unesco.org/ark:/48223/pf0000389227",
    support:
      "Orienta el uso humano, seguro, inclusivo y pedagógicamente pertinente de sistemas generativos.",
  },
  {
    label: "OCDE · Evaluación formativa y retroalimentación",
    url: "https://www.oecd.org/en/publications/unlocking-high-quality-teaching_f5b82176-en.html",
    support:
      "Describe el uso de metas, evidencia y retroalimentación para adaptar la enseñanza.",
  },
  {
    label: "OpenAI · ChatGPT para evaluación y retroalimentación",
    url: "https://help.openai.com/en/articles/8313397-how-can-chatgpt-be-used-for-assessment-and-feedback",
    support:
      "Presenta la IA como apoyo para borradores y mantiene la revisión humana sobre la decisión evaluativa.",
  },
] as const;

export const additionalActivities = [
  {
    time: "10 minutos",
    title: "El instrumento equivocado",
    purpose: "Reconocer qué información se pierde al usar una lista de cotejo para valorar calidad.",
    instruction:
      "Valora la misma evidencia con rúbrica y cotejo; compara qué permite afirmar cada instrumento.",
    interaction: "Contraste en parejas y decisión justificada.",
    feedback:
      "La elección se justifica por el propósito y el tipo de evidencia, no por la facilidad para obtener un número.",
  },
  {
    time: "15 minutos",
    title: "Cirugía de descriptores",
    purpose: "Sustituir etiquetas vagas por desempeños observables.",
    instruction:
      "Reescribe excelente, regular y deficiente mediante acciones o rasgos visibles en el producto.",
    interaction: "Edición y prueba con dos evidencias ficticias.",
    feedback:
      "Los niveles deben describir el mismo atributo y permitir localizar evidencia.",
  },
  {
    time: "20 minutos",
    title: "Triangulación mínima",
    purpose: "Combinar dos instrumentos sin duplicar información.",
    instruction:
      "Relaciona una guía de observación con un portafolio y explica qué aporta cada fuente a la decisión.",
    interaction: "Diseño de matriz y revisión cruzada.",
    feedback:
      "Triangular no es repetir la medición, sino contrastar información complementaria y reconocer discrepancias.",
  },
] as const;

export const faq = [
  [
    "¿Debo completar las tres rutas?",
    "No. Elige una. Intermedia acumula Básica y Avanzada acumula las dos anteriores.",
  ],
  [
    "¿Puedo usar mi propia secuencia?",
    "Sí. Registra contexto, propósito, evidencia y momentos; si no está completa, usa uno de los cuatro casos ficticios.",
  ],
  [
    "¿Debo cargar datos reales del alumnado?",
    "No. La sesión incluye 50 resultados ficticios y no solicita nombres, matrículas, diagnósticos ni trabajos identificables.",
  ],
  [
    "¿Un tablero puede explicar por qué un grupo obtuvo menor promedio?",
    "No por sí solo. Describe patrones; las causas requieren revisar condiciones, evidencias y otras fuentes.",
  ],
  [
    "¿La IA puede asignar la calificación final?",
    "No en esta práctica. Produce borradores; la decisión corresponde a la persona docente y a las reglas institucionales.",
  ],
  [
    "¿Qué pasa si no abre ChatGPT, Gemini o NotebookLM?",
    "Usa las contingencias integradas de instrumento y análisis; permiten terminar los dos laboratorios sin una herramienta externa.",
  ],
  [
    "¿La preparación acredita la sesión?",
    "No. Tiene registro y evidencia propios, pero no sustituye asistencia ni evidencia de la sesión principal.",
  ],
] as const;
