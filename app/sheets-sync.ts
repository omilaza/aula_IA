import { env } from "cloudflare:workers";

export type SheetSyncStatus = "synced" | "not_configured" | "failed";

export type SheetSyncResult = {
  status: SheetSyncStatus;
  detail?: string;
  attempts?: number;
  referenceCode?: string;
  idempotent?: boolean;
};

type SyncEnvironment = Cloudflare.Env & {
  GOOGLE_SHEETS_WEBHOOK_URL?: string;
  GOOGLE_SHEETS_WEBHOOK_SECRET?: string;
};

function safeDetail(value: unknown) {
  return typeof value === "string" ? value.slice(0, 240) : "";
}

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

/**
 * Mirrors an already-persisted D1 record to the institutional Google Sheet.
 * A Sheet outage never discards the record already saved in D1.
 *
 * Every receiver action supplies its own stable key (the survey uses its
 * response folio), so a small number of immediate retries is safe and reduces
 * transient Apps Script failures. A final failure is reported honestly; the
 * caller may persist it in an outbox for a later retry.
 */
export async function syncToInstitutionalSheet(
  payload: Record<string, unknown>,
): Promise<SheetSyncResult> {
  const runtime = env as SyncEnvironment;
  const url = runtime.GOOGLE_SHEETS_WEBHOOK_URL?.trim();
  const secret = runtime.GOOGLE_SHEETS_WEBHOOK_SECRET?.trim();

  if (!url || !secret) return { status: "not_configured" };

  const retryDelays = [0, 400, 1_200];
  let lastDetail = "Error de conexión";

  for (let index = 0; index < retryDelays.length; index += 1) {
    if (retryDelays[index] > 0) await wait(retryDelays[index]);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6_000);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "text/plain;charset=UTF-8" },
        body: JSON.stringify({ ...payload, secret }),
        signal: controller.signal,
      });
      const result = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      if (response.ok && result.ok === true) {
        return {
          status: "synced", attempts: index + 1,
          ...(typeof result.referenceCode === "string"
            ? { referenceCode: safeDetail(result.referenceCode) }
            : {}),
          ...(result.idempotent === true ? { idempotent: true } : {}),
        };
      }
      lastDetail = safeDetail(result.error) || `HTTP ${response.status}`;
    } catch (error) {
      lastDetail =
        error instanceof Error ? safeDetail(error.message) : "Error de conexión";
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    status: "failed",
    detail: lastDetail,
    attempts: retryDelays.length,
  };
}
