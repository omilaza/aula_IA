export const courseSurveyDimensionOrder = [
  { key: "general", field: "generalRating", label: "Curso general" },
  { key: "contents", field: "contentRating", label: "Contenidos" },
  { key: "instructor", field: "instructorRating", label: "Instructor" },
  { key: "platform", field: "platformRating", label: "Plataforma" },
  { key: "activities", field: "activitiesRating", label: "Actividades" },
  { key: "materials", field: "materialsRating", label: "Materiales" },
] as const;

export const courseSurveyRecommendationOrder = [
  { value: "definitely_yes", label: "Sí, definitivamente" },
  { value: "probably_yes", label: "Probablemente sí" },
  { value: "unsure", label: "Aún no estoy seguro/a" },
  { value: "probably_no", label: "Probablemente no" },
  { value: "definitely_no", label: "No por ahora" },
] as const;

type DimensionField = (typeof courseSurveyDimensionOrder)[number]["field"];

export type CourseSurveyAnalyticsRow = Record<DimensionField, number | null> & {
  materialsNotUsed: boolean;
  recommendationApplication: string;
  sheetSyncStatus?: string | null;
};

type DimensionSummary = {
  key: (typeof courseSurveyDimensionOrder)[number]["key"];
  label: string;
  average: number | null;
  denominator: number;
};

function isRating(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 5;
}

function roundTwo(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function summarizeDimension(
  rows: readonly CourseSurveyAnalyticsRow[],
  definition: (typeof courseSurveyDimensionOrder)[number],
): DimensionSummary {
  const ratings = rows
    .filter((row) => definition.field !== "materialsRating" || !row.materialsNotUsed)
    .map((row) => row[definition.field])
    .filter(isRating);

  return {
    key: definition.key,
    label: definition.label,
    average: ratings.length
      ? roundTwo(ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length)
      : null,
    denominator: ratings.length,
  };
}

export function computeCourseSurveyAnalytics(
  rows: readonly CourseSurveyAnalyticsRow[],
) {
  const totalResponses = rows.length;
  const dimensions = courseSurveyDimensionOrder.map((definition) =>
    summarizeDimension(rows, definition),
  );
  const general = dimensions[0];
  const comparableDimensions = dimensions.filter(
    (dimension): dimension is DimensionSummary & { average: number } =>
      dimension.average !== null,
  );
  const bestDimension = comparableDimensions.reduce<
    (DimensionSummary & { average: number }) | null
  >(
    (best, dimension) =>
      best === null || dimension.average > best.average ? dimension : best,
    null,
  );
  const improvementOpportunity = comparableDimensions.reduce<
    (DimensionSummary & { average: number }) | null
  >(
    (lowest, dimension) =>
      lowest === null || dimension.average < lowest.average ? dimension : lowest,
    null,
  );

  const generalDistribution: Record<"1" | "2" | "3" | "4" | "5", number> = {
    "1": 0,
    "2": 0,
    "3": 0,
    "4": 0,
    "5": 0,
  };
  for (const row of rows) {
    if (isRating(row.generalRating)) {
      generalDistribution[String(row.generalRating) as keyof typeof generalDistribution] += 1;
    }
  }

  const recommendationCounts = Object.fromEntries(
    courseSurveyRecommendationOrder.map(({ value }) => [value, 0]),
  ) as Record<(typeof courseSurveyRecommendationOrder)[number]["value"], number>;
  let recommendationUnanswered = 0;
  for (const row of rows) {
    if (row.recommendationApplication in recommendationCounts) {
      recommendationCounts[
        row.recommendationApplication as keyof typeof recommendationCounts
      ] += 1;
    } else {
      recommendationUnanswered += 1;
    }
  }
  const recommendationAnswered = totalResponses - recommendationUnanswered;

  const materialsNotUsedCount = rows.filter((row) => row.materialsNotUsed).length;
  const sync = { synced: 0, pending: 0, failed: 0 };
  for (const row of rows) {
    const status = row.sheetSyncStatus;
    if (status === "synced" || status === "failed") {
      sync[status] += 1;
    } else {
      sync.pending += 1;
    }
  }
  const syncState =
    totalResponses === 0
      ? "empty"
      : sync.failed > 0
        ? "requires_attention"
        : sync.pending > 0
          ? "pending"
          : "synced";

  return {
    empty: totalResponses === 0,
    totalResponses,
    overallAverage: general.average,
    overallDenominator: general.denominator,
    dimensions,
    generalDistribution,
    recommendation: {
      answered: recommendationAnswered,
      unanswered: recommendationUnanswered,
      options: courseSurveyRecommendationOrder.map(({ value, label }) => ({
        value,
        label,
        count: recommendationCounts[value],
        proportion:
          recommendationAnswered > 0
            ? roundTwo(recommendationCounts[value] / recommendationAnswered)
            : null,
      })),
    },
    materialsNotUsed: {
      count: materialsNotUsedCount,
      denominator: totalResponses,
      proportion:
        totalResponses > 0 ? roundTwo(materialsNotUsedCount / totalResponses) : null,
    },
    bestDimension,
    improvementOpportunity,
    synchronization: {
      ...sync,
      total: totalResponses,
      state: syncState,
    },
  };
}

type CsvCell = string | number | boolean | null | undefined;

function csvCell(value: CsvCell) {
  if (value === null || value === undefined) return '""';
  return `"${String(value).replaceAll('"', '""')}"`;
}

function proportion(count: number, denominator: number) {
  return denominator > 0 ? roundTwo(count / denominator) : null;
}

/**
 * Stable, non-identifiable export consumed by Google Sheets IMPORTDATA.
 * The metric key and row order are part of the dashboard contract.
 */
export function courseSurveyAnalyticsCsv(
  analytics: ReturnType<typeof computeCourseSurveyAnalytics>,
) {
  const rows: CsvCell[][] = [
    ["metric", "label", "value", "denominator", "proportion", "note"],
    [
      "total_responses",
      "Total de respuestas",
      analytics.totalResponses,
      analytics.totalResponses,
      null,
      null,
    ],
    [
      "survey_state",
      "Estado de la encuesta",
      analytics.empty ? "empty" : "available",
      analytics.totalResponses,
      null,
      analytics.empty ? "Sin respuestas todavía" : "Respuestas disponibles",
    ],
    [
      "overall_average",
      "Promedio general",
      analytics.overallAverage,
      analytics.overallDenominator,
      null,
      "Escala de 1 a 5",
    ],
    ...analytics.dimensions.map((dimension) => [
      `dimension_${dimension.key}`,
      dimension.label,
      dimension.average,
      dimension.denominator,
      null,
      dimension.key === "materials"
        ? "Excluye No los utilicé / No aplica"
        : "Escala de 1 a 5",
    ] satisfies CsvCell[]),
    ...Object.entries(analytics.generalDistribution).map(([rating, count]) => [
      `general_rating_${rating}`,
      `${rating} ${rating === "1" ? "estrella" : "estrellas"}`,
      count,
      analytics.overallDenominator,
      proportion(count, analytics.overallDenominator),
      "Distribución de satisfacción general",
    ] satisfies CsvCell[]),
    ...analytics.recommendation.options.map((option) => [
      `recommendation_${option.value}`,
      option.label,
      option.count,
      analytics.recommendation.answered,
      option.proportion,
      "Distribución entre quienes respondieron",
    ] satisfies CsvCell[]),
    [
      "recommendation_unanswered",
      "Sin respuesta",
      analytics.recommendation.unanswered,
      analytics.totalResponses,
      proportion(analytics.recommendation.unanswered, analytics.totalResponses),
      "Pregunta opcional",
    ],
    [
      "materials_not_used",
      "No utilicé materiales / No aplica",
      analytics.materialsNotUsed.count,
      analytics.materialsNotUsed.denominator,
      analytics.materialsNotUsed.proportion,
      "Excluido del promedio de materiales",
    ],
    [
      "best_dimension",
      "Dimensión mejor valorada",
      analytics.bestDimension?.average,
      analytics.bestDimension?.denominator,
      null,
      analytics.bestDimension?.label,
    ],
    [
      "improvement_opportunity",
      "Principal oportunidad de mejora",
      analytics.improvementOpportunity?.average,
      analytics.improvementOpportunity?.denominator,
      null,
      analytics.improvementOpportunity?.label,
    ],
    [
      "sync_total",
      "Total con seguimiento de sincronización",
      analytics.synchronization.total,
      analytics.synchronization.total,
      null,
      null,
    ],
    [
      "sync_synced",
      "Sincronizadas",
      analytics.synchronization.synced,
      analytics.synchronization.total,
      proportion(analytics.synchronization.synced, analytics.synchronization.total),
      null,
    ],
    [
      "sync_pending",
      "Pendientes",
      analytics.synchronization.pending,
      analytics.synchronization.total,
      proportion(analytics.synchronization.pending, analytics.synchronization.total),
      null,
    ],
    [
      "sync_failed",
      "Con fallo de sincronización",
      analytics.synchronization.failed,
      analytics.synchronization.total,
      proportion(analytics.synchronization.failed, analytics.synchronization.total),
      null,
    ],
    [
      "sync_state",
      "Estado de sincronización",
      analytics.synchronization.state,
      analytics.synchronization.total,
      null,
      analytics.synchronization.state === "empty"
        ? "Sin respuestas todavía"
        : analytics.synchronization.state === "synced"
          ? "Al día"
          : analytics.synchronization.state === "pending"
            ? "Con pendientes"
            : "Requiere revisión",
    ],
  ];

  return `${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}
