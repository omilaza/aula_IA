import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import {
  courseSatisfactionSurveyResponses,
  courseSatisfactionSurveySync,
} from "../../../db/schema";
import {
  courseSurveyAnalyticsCsv,
  computeCourseSurveyAnalytics,
  type CourseSurveyAnalyticsRow,
} from "../../course-survey-analytics";

const responseHeaders = {
  "Cache-Control": "no-store, private",
  Pragma: "no-cache",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "Cross-Origin-Resource-Policy": "same-origin",
};

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: responseHeaders });
}

/**
 * Exposes only non-identifiable aggregates for the institutional dashboard.
 * Names, emails, folios and open comments are deliberately absent from both
 * the SELECT and the response.
 */
export async function GET(request: Request) {
  try {
    const db = getDb();
    const rows = await db
      .select({
        generalRating: courseSatisfactionSurveyResponses.generalRating,
        contentRating: courseSatisfactionSurveyResponses.contentRating,
        instructorRating: courseSatisfactionSurveyResponses.instructorRating,
        platformRating: courseSatisfactionSurveyResponses.platformRating,
        activitiesRating: courseSatisfactionSurveyResponses.activitiesRating,
        materialsRating: courseSatisfactionSurveyResponses.materialsRating,
        materialsNotUsed: courseSatisfactionSurveyResponses.materialsNotUsed,
        recommendationApplication:
          courseSatisfactionSurveyResponses.recommendationApplication,
        sheetSyncStatus: courseSatisfactionSurveySync.status,
      })
      .from(courseSatisfactionSurveyResponses)
      .leftJoin(
        courseSatisfactionSurveySync,
        eq(
          courseSatisfactionSurveyResponses.idempotencyKey,
          courseSatisfactionSurveySync.idempotencyKey,
        ),
      );

    const analytics = computeCourseSurveyAnalytics(
      rows as CourseSurveyAnalyticsRow[],
    );
    if (new URL(request.url).searchParams.get("format") === "csv") {
      return new Response(courseSurveyAnalyticsCsv(analytics), {
        status: 200,
        headers: {
          ...responseHeaders,
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition":
            'inline; filename="aula-ia-satisfaccion-agregada.csv"',
        },
      });
    }

    return json({ ok: true, generatedAt: new Date().toISOString(), ...analytics });
  } catch {
    return json(
      {
        ok: false,
        error:
          "No fue posible actualizar el resumen en este momento. No se muestran cifras parciales.",
      },
      503,
    );
  }
}
