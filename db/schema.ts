import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const attendance = sqliteTable(
  "attendance",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    email: text("email").notNull(),
    fullName: text("full_name").notNull(),
    institution: text("institution").notNull(),
    role: text("role").notNull(),
    session: text("session").notNull().default("S1"),
    consent: integer("consent", { mode: "boolean" }).notNull().default(false),
    confirmationCode: text("confirmation_code").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("attendance_session_email_unique").on(table.session, table.email),
  ],
);

export const diagnostics = sqliteTable(
  "diagnostics",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    email: text("email").notNull(),
    phase: text("phase").notNull().default("pre"),
    answersJson: text("answers_json").notNull(),
    likertAverage: integer("likert_average_x100").notNull(),
    knowledgeScore: integer("knowledge_score").notNull(),
    confirmationCode: text("confirmation_code").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("diagnostics_phase_email_unique").on(table.phase, table.email),
  ],
);

export const icebreakerResponses = sqliteTable("icebreaker_responses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  category: text("category").notNull(),
  task: text("task").notNull(),
  session: text("session").notNull().default("S1"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const labEvidence = sqliteTable(
  "lab_evidence",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    email: text("email").notNull(),
    session: text("session").notNull().default("S1"),
    route: text("route").notNull(),
    caseKey: text("case_key").notNull(),
    contextJson: text("context_json").notNull(),
    promptV1: text("prompt_v1").notNull(),
    promptV2: text("prompt_v2").notNull(),
    responseV1: text("response_v1").notNull().default(""),
    responseV2: text("response_v2").notNull().default(""),
    review: text("review").notNull(),
    checklistJson: text("checklist_json").notNull(),
    evidenceCode: text("evidence_code").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("lab_session_email_unique").on(table.session, table.email),
  ],
);

export const exitTickets = sqliteTable(
  "exit_tickets",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    email: text("email").notNull(),
    session: text("session").notNull().default("S1"),
    learning: text("learning").notNull(),
    application: text("application").notNull(),
    remainingQuestion: text("remaining_question").notNull().default(""),
    confidence: integer("confidence").notNull(),
    evidenceCode: text("evidence_code").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("exit_session_email_unique").on(table.session, table.email),
  ],
);

/**
 * Orientación de habilidades digitales para la Sesión 2.
 *
 * Este diagnóstico no acredita el curso. Su único propósito es recomendar,
 * con lenguaje respetuoso, la ruta preparatoria o la ruta principal.
 */
export const digitalSkillDiagnostics = sqliteTable(
  "digital_skill_diagnostics",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    participantId: text("participant_id").notNull(),
    fullName: text("full_name").notNull(),
    email: text("email").notNull(),
    session: text("session").notNull().default("S2"),
    route: text("route").notNull().default("orientacion"),
    activity: text("activity").notNull().default("diagnostico-digital"),
    answersJson: text("answers_json").notNull(),
    digitalScore: integer("digital_score").notNull(),
    identifiedLevel: text("identified_level").notNull(),
    recommendedRoute: text("recommended_route").notNull(),
    attempt: integer("attempt").notNull().default(1),
    responseVersion: integer("response_version").notNull().default(1),
    status: text("status").notNull().default("completado"),
    confirmationCode: text("confirmation_code").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("digital_diagnostic_control_unique").on(
      table.email,
      table.session,
      table.route,
      table.activity,
    ),
  ],
);

/**
 * Registro unificado de entrada y actividades de la nivelación de S2.
 *
 * La actividad forma parte de la clave de control para que un reenvío
 * actualice el registro anterior en vez de crear una fila duplicada.
 */
export const levelingRecords = sqliteTable(
  "leveling_records",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    participantId: text("participant_id").notNull(),
    fullName: text("full_name").notNull(),
    email: text("email").notNull(),
    institution: text("institution").notNull().default(""),
    role: text("role").notNull().default(""),
    session: text("session").notNull().default("S2"),
    route: text("route").notNull().default("preparatoria"),
    activity: text("activity").notNull(),
    evidenceType: text("evidence_type").notNull(),
    responseJson: text("response_json").notNull(),
    result: text("result").notNull().default(""),
    attempt: integer("attempt").notNull().default(1),
    responseVersion: integer("response_version").notNull().default(1),
    status: text("status").notNull().default("completado"),
    confirmationCode: text("confirmation_code").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("leveling_record_control_unique").on(
      table.email,
      table.session,
      table.route,
      table.activity,
    ),
  ],
);

/**
 * Evidencia acreditable de la Sesión 2 principal.
 */
export const sessionTwoEvidence = sqliteTable(
  "session_two_evidence",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    participantId: text("participant_id").notNull(),
    fullName: text("full_name").notNull(),
    email: text("email").notNull(),
    session: text("session").notNull().default("S2"),
    route: text("route").notNull().default("principal"),
    activity: text("activity").notNull().default("evidencia-principal"),
    productTitle: text("product_title").notNull(),
    purpose: text("purpose").notNull(),
    pedagogicalContext: text("pedagogical_context").notNull(),
    sources: text("sources").notNull(),
    prompt: text("prompt").notNull(),
    aiResult: text("ai_result").notNull(),
    teacherReview: text("teacher_review").notNull(),
    detectedRisk: text("detected_risk").notNull(),
    adjustment: text("adjustment").notNull(),
    checklistJson: text("checklist_json").notNull(),
    attempt: integer("attempt").notNull().default(1),
    responseVersion: integer("response_version").notNull().default(1),
    status: text("status").notNull().default("recibida"),
    confirmationCode: text("confirmation_code").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("session_two_evidence_control_unique").on(
      table.email,
      table.session,
      table.route,
      table.activity,
    ),
  ],
);

/**
 * Evidencia acreditable de la Sesión 3 principal.
 *
 * Se conserva en una tabla independiente para que la ampliación sea aditiva
 * y no altere la estructura ni los registros de las sesiones anteriores.
 */
export const sessionThreeEvidence = sqliteTable(
  "session_three_evidence",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    participantId: text("participant_id").notNull(),
    fullName: text("full_name").notNull(),
    email: text("email").notNull(),
    session: text("session").notNull().default("S3"),
    route: text("route").notNull().default("principal"),
    activity: text("activity").notNull().default("evidencia-principal"),
    sequenceTitle: text("sequence_title").notNull(),
    educationalLevel: text("educational_level").notNull(),
    subject: text("subject").notNull(),
    difficultyLevel: text("difficulty_level").notNull(),
    purpose: text("purpose").notNull(),
    pedagogicalContext: text("pedagogical_context").notNull(),
    sources: text("sources").notNull(),
    prompt: text("prompt").notNull(),
    aiDraft: text("ai_draft").notNull(),
    activitySequence: text("activity_sequence").notNull(),
    assessmentEvidence: text("assessment_evidence").notNull(),
    teacherReview: text("teacher_review").notNull(),
    detectedRisk: text("detected_risk").notNull(),
    adaptation: text("adaptation").notNull(),
    adjustment: text("adjustment").notNull(),
    checklistJson: text("checklist_json").notNull(),
    attempt: integer("attempt").notNull().default(1),
    responseVersion: integer("response_version").notNull().default(1),
    status: text("status").notNull().default("recibida"),
    confirmationCode: text("confirmation_code").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("session_three_evidence_control_unique").on(
      table.email,
      table.session,
      table.route,
      table.activity,
    ),
  ],
);

/**
 * Evidencia acreditable de la Sesión 4 principal.
 *
 * La tabla es aditiva: no modifica la estructura ni los registros de S1–S3.
 * El caso, nivel y dificultad se conservan juntos para validar las nueve rutas.
 */
export const sessionFourEvidence = sqliteTable(
  "session_four_evidence",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    participantId: text("participant_id").notNull(),
    fullName: text("full_name").notNull(),
    email: text("email").notNull(),
    session: text("session").notNull().default("S4"),
    route: text("route").notNull().default("principal"),
    activity: text("activity").notNull().default("evidencia-principal"),
    caseKey: text("case_key").notNull(),
    evaluationTitle: text("evaluation_title").notNull(),
    educationalLevel: text("educational_level").notNull(),
    subject: text("subject").notNull(),
    difficultyLevel: text("difficulty_level").notNull(),
    learningPurpose: text("learning_purpose").notNull(),
    evaluationMoment: text("evaluation_moment").notNull(),
    pedagogicalContext: text("pedagogical_context").notNull(),
    sourceCase: text("source_case").notNull(),
    criteriaIndicators: text("criteria_indicators").notNull(),
    prompt: text("prompt").notNull(),
    aiDraft: text("ai_draft").notNull(),
    evidenceAnalysis: text("evidence_analysis").notNull(),
    generatedFeedback: text("generated_feedback").notNull(),
    teacherReview: text("teacher_review").notNull(),
    detectedRisk: text("detected_risk").notNull(),
    adaptation: text("adaptation").notNull(),
    finalDecision: text("final_decision").notNull(),
    checklistJson: text("checklist_json").notNull(),
    attempt: integer("attempt").notNull().default(1),
    responseVersion: integer("response_version").notNull().default(1),
    status: text("status").notNull().default("recibida"),
    confirmationCode: text("confirmation_code").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("session_four_evidence_control_unique").on(
      table.email,
      table.session,
      table.route,
      table.activity,
    ),
  ],
);

/**
 * Evidencia acreditable de la Sesión 5 principal.
 *
 * La ampliación es aditiva y mantiene intactas las tablas de S1–S4. La
 * preparación continúa utilizando `leveling_records`, separada por sesión,
 * ruta y actividad.
 */
export const sessionFiveEvidence = sqliteTable(
  "session_five_evidence",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    participantId: text("participant_id").notNull(),
    fullName: text("full_name").notNull(),
    email: text("email").notNull(),
    session: text("session").notNull().default("S5"),
    route: text("route").notNull().default("principal"),
    activity: text("activity").notNull().default("evidencia-principal"),
    sequenceKey: text("sequence_key").notNull(),
    sequenceTitle: text("sequence_title").notNull(),
    educationalLevel: text("educational_level").notNull(),
    subject: text("subject").notNull(),
    difficultyLevel: text("difficulty_level").notNull(),
    instrumentType: text("instrument_type").notNull(),
    learningPurpose: text("learning_purpose").notNull(),
    pedagogicalContext: text("pedagogical_context").notNull(),
    sourceCase: text("source_case").notNull(),
    instrumentDesign: text("instrument_design").notNull(),
    criteriaDescriptors: text("criteria_descriptors").notNull(),
    prompt: text("prompt").notNull(),
    aiDraft: text("ai_draft").notNull(),
    datasetSummary: text("dataset_summary").notNull(),
    findings: text("findings").notNull(),
    groupComparison: text("group_comparison").notNull(),
    teacherDecision: text("teacher_decision").notNull(),
    limitations: text("limitations").notNull(),
    adaptation: text("adaptation").notNull(),
    checklistJson: text("checklist_json").notNull(),
    attempt: integer("attempt").notNull().default(1),
    responseVersion: integer("response_version").notNull().default(1),
    status: text("status").notNull().default("recibida"),
    confirmationCode: text("confirmation_code").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("session_five_evidence_control_unique").on(
      table.email,
      table.session,
      table.route,
      table.activity,
    ),
  ],
);

/**
 * Producto final integrado de la Sesión 6.
 *
 * La tabla es estrictamente aditiva: conserva intactas las tablas y los
 * registros de S1–S5. Cada correo conserva un único producto final; la ruta
 * registra el último nivel de andamiaje elegido, sin crear otra evidencia.
 */
export const sessionSixEvidence = sqliteTable(
  "session_six_evidence",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    participantId: text("participant_id").notNull(),
    fullName: text("full_name").notNull(),
    email: text("email").notNull(),
    session: text("session").notNull().default("S6"),
    route: text("route").notNull(),
    activity: text("activity").notNull().default("evidencia-principal"),
    projectTitle: text("project_title").notNull(),
    teachingNeed: text("teaching_need").notNull(),
    educationalLevel: text("educational_level").notNull(),
    subject: text("subject").notNull(),
    pedagogicalContext: text("pedagogical_context").notNull(),
    learningPurpose: text("learning_purpose").notNull(),
    sourceTraceability: text("source_traceability").notNull(),
    prompt: text("prompt").notNull(),
    activitySequence: text("activity_sequence").notNull(),
    assessmentEvidence: text("assessment_evidence").notNull(),
    instrumentCriteria: text("instrument_criteria").notNull(),
    analysisLimits: text("analysis_limits").notNull(),
    teacherDecision: text("teacher_decision").notNull(),
    followUpEvidence: text("follow_up_evidence").notNull(),
    adaptation: text("adaptation").notNull(),
    aiContribution: text("ai_contribution").notNull(),
    teacherReview: text("teacher_review").notNull(),
    implementationStep: text("implementation_step").notNull(),
    checklistJson: text("checklist_json").notNull(),
    attempt: integer("attempt").notNull().default(1),
    responseVersion: integer("response_version").notNull().default(1),
    status: text("status").notNull().default("recibida"),
    confirmationCode: text("confirmation_code").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("session_six_evidence_control_unique").on(
      table.email,
      table.session,
      table.activity,
    ),
  ],
);

/**
 * Encuesta profesional de satisfacción del curso completo.
 *
 * Este registro es independiente de la asistencia y de las evidencias
 * académicas. La identidad es opcional y la clave de idempotencia evita que un
 * doble clic o reintento de red cree dos respuestas.
 */
export const courseSatisfactionSurveyResponses = sqliteTable(
  "course_satisfaction_survey_responses",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    idempotencyKey: text("idempotency_key").notNull(),
    isAnonymous: integer("is_anonymous", { mode: "boolean" })
      .notNull()
      .default(true),
    name: text("name").notNull().default(""),
    email: text("email").notNull().default(""),
    generalRating: integer("general_rating").notNull(),
    contentRating: integer("content_rating").notNull(),
    instructorRating: integer("instructor_rating").notNull(),
    platformRating: integer("platform_rating").notNull(),
    activitiesRating: integer("activities_rating"),
    materialsRating: integer("materials_rating"),
    materialsNotUsed: integer("materials_not_used", { mode: "boolean" })
      .notNull()
      .default(false),
    recommendationApplication: text("recommendation_application").notNull().default(""),
    likedMost: text("liked_most").notNull().default(""),
    improvements: text("improvements").notNull().default(""),
    additionalComments: text("additional_comments").notNull().default(""),
    referenceCode: text("reference_code").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("course_satisfaction_survey_idempotency_unique").on(
      table.idempotencyKey,
    ),
  ],
);

/**
 * Bandeja persistente para reflejar la encuesta en la hoja institucional.
 *
 * La respuesta anterior permanece como fuente primaria. Esta tabla aditiva
 * permite reintentar una réplica sin duplicarla y sin alterar el registro de
 * la encuesta cuando Google Sheets no está disponible temporalmente.
 */
export const courseSatisfactionSurveySync = sqliteTable(
  "course_satisfaction_survey_sync",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    idempotencyKey: text("idempotency_key").notNull(),
    referenceCode: text("reference_code").notNull(),
    status: text("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    lastAttemptAt: text("last_attempt_at"),
    lastError: text("last_error").notNull().default(""),
    syncedAt: text("synced_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("course_satisfaction_survey_sync_idempotency_unique").on(
      table.idempotencyKey,
    ),
    index("course_satisfaction_survey_sync_status_idx").on(table.status),
  ],
);
