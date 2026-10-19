export type CourseSurveySheetSyncStatus = "pending" | "synced" | "failed";

export type CourseSurveySheetTransportResult = {
  status: "synced" | "not_configured" | "failed";
  attempts?: number;
  detail?: string;
  referenceCode?: string;
  idempotent?: boolean;
};

export type CourseSurveySheetRow = {
  id: number;
  idempotencyKey: string;
  isAnonymous: boolean;
  name: string;
  email: string;
  generalRating: number;
  contentRating: number;
  instructorRating: number;
  platformRating: number;
  activitiesRating: number | null;
  materialsRating: number | null;
  materialsNotUsed: boolean;
  recommendationApplication: string;
  likedMost: string;
  improvements: string;
  additionalComments: string;
  referenceCode: string;
  createdAt: string;
};

export function courseSurveySheetPayload(row: CourseSurveySheetRow) {
  return {
    action: "course_satisfaction_survey",
    referenceCode: row.referenceCode,
    submittedAt: row.createdAt,
    responseMode: row.isAnonymous ? "Anónima" : "Con seguimiento",
    name: row.name,
    email: row.email,
    generalRating: row.generalRating,
    contentRating: row.contentRating,
    instructorRating: row.instructorRating,
    platformRating: row.platformRating,
    activitiesRating: row.activitiesRating,
    materialsRating: row.materialsRating,
    materialsNotUsed: row.materialsNotUsed,
    recommendationApplication: row.recommendationApplication,
    likedMost: row.likedMost,
    improvements: row.improvements,
    additionalComments: row.additionalComments,
    idempotencyKey: row.idempotencyKey,
    source: "AULA-IA /encuesta-satisfaccion",
  };
}

export function courseSurveyStoredSyncUpdate(
  result: CourseSurveySheetTransportResult,
  attemptedAt: string,
) {
  const attempts = Math.max(0, Math.trunc(result.attempts || 0));
  if (result.status === "synced") {
    return {
      status: "synced" as const,
      attemptsDelta: attempts,
      lastAttemptAt: attempts ? attemptedAt : null,
      lastError: "",
      syncedAt: attemptedAt,
    };
  }
  if (result.status === "not_configured") {
    return {
      status: "pending" as const,
      attemptsDelta: 0,
      lastAttemptAt: null,
      lastError: "",
      syncedAt: null,
    };
  }
  return {
    status: "failed" as const,
    attemptsDelta: attempts,
    lastAttemptAt: attemptedAt,
    lastError:
      typeof result.detail === "string" ? result.detail.slice(0, 240) : "Error de conexión",
    syncedAt: null,
  };
}
