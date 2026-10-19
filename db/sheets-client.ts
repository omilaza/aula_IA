import { getTableName, type InferInsertModel, type InferSelectModel } from "drizzle-orm";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";

export const currentTimestamp = { op: "timestamp" } as const;
export const increment = (value: number) => ({ op: "increment", value }) as const;
type Update<T extends SQLiteTable> = {
  [K in keyof InferSelectModel<T>]?: InferSelectModel<T>[K] | typeof currentTimestamp | ReturnType<typeof increment>;
};
type Options = { limit?: number; orderBy?: string; descending?: boolean; columns?: string[] };
type ClientOptions = {
  url?: string; secret?: string; fetch?: typeof fetch; requestId?: () => string;
  timeoutMs?: number; retryDelayMs?: number;
};

class StorageError extends Error {
  retryable: boolean;
  constructor(message: string, retryable = false) { super(message); this.retryable = retryable; }
}

/** Server-to-server repository: credentials and nominal queries stay in the Worker. */
export function createSheetsRepository(options: ClientOptions) {
  const url = options.url?.trim();
  const secret = options.secret?.trim();
  if (!url || !secret || secret.length < 32) {
    throw new StorageError("Configura GOOGLE_SHEETS_WEBHOOK_URL y GOOGLE_SHEETS_WEBHOOK_SECRET en el Worker.");
  }
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || parsed.hostname !== "script.google.com" ||
      !/^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(parsed.pathname) || parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new StorageError("La URL de Google debe ser la implementación web de Apps Script terminada en /exec.");
  }
  const transport = options.fetch || fetch;

  async function call(operation: string, table: SQLiteTable, args: Record<string, unknown>) {
    const requestId = (options.requestId || (() => crypto.randomUUID()))();
    const body = JSON.stringify({ action: "storage", version: 1, secret, requestId, operation, table: getTableName(table), ...args });
    for (let attempt = 0; attempt < 3; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 25_000);
      try {
        const response = await transport(url!, {
          method: "POST", headers: { "content-type": "text/plain;charset=UTF-8" }, body,
          signal: controller.signal, redirect: "follow",
        });
        if (!response.ok) throw new StorageError("Google Sheets no confirmó la operación.", response.status >= 500 || response.status === 429);
        const data = await response.json() as Record<string, unknown>;
        if (data.ok !== true) {
          const code = (data.error as { code?: string } | undefined)?.code;
          throw new StorageError("Google Sheets no confirmó la operación.", code === "BUSY" || code === "STORAGE_FAILED");
        }
        if (data.version !== 1 || data.requestId !== requestId || !Object.hasOwn(data, "result")) {
          throw new StorageError("El receptor de Google no confirmó la solicitud esperada.");
        }
        return data.result;
      } catch (error) {
        if (attempt === 2 || (error instanceof StorageError && !error.retryable)) {
          // Never leak secrets, upstream bodies, or submitted answers in errors.
          throw new StorageError("No se pudo confirmar el guardado o la consulta en Google Sheets. Conserva el formulario y vuelve a intentarlo.");
        }
      } finally { clearTimeout(timeout); }
      await new Promise((resolve) => setTimeout(resolve, options.retryDelayMs ?? 600 * (attempt + 1)));
    }
    throw new StorageError("Google Sheets no disponible.");
  }

  function record<T extends SQLiteTable>(result: unknown, expected: Partial<InferInsertModel<T>>): InferSelectModel<T> {
    if (!result || typeof result !== "object" || Array.isArray(result)) throw new StorageError("Respuesta de registro no válida.");
    const row = result as Record<string, unknown>;
    for (const key of ["confirmationCode", "evidenceCode", "idempotencyKey"] as const) {
      const value = (expected as Record<string, unknown>)[key];
      if (value !== undefined && row[key] !== value) throw new StorageError("El registro recibido no corresponde al envío.");
    }
    return result as InferSelectModel<T>;
  }

  return {
    async find<T extends SQLiteTable>(table: T, filters: Partial<InferSelectModel<T>> = {}, opts: Options = {}): Promise<InferSelectModel<T>[]> {
      const result = await call("find", table, { filters, options: opts });
      if (!Array.isArray(result)) throw new StorageError("Respuesta de consulta no válida.");
      return result as InferSelectModel<T>[];
    },
    async insert<T extends SQLiteTable>(table: T, values: InferInsertModel<T>): Promise<InferSelectModel<T>> {
      return record<T>(await call("insert", table, { values }), values);
    },
    async upsert<T extends SQLiteTable>(table: T, values: InferInsertModel<T>, updates: Update<T>): Promise<InferSelectModel<T>> {
      return record<T>(await call("upsert", table, { values, updates }), values);
    },
    async insertIfAbsent<T extends SQLiteTable>(table: T, values: InferInsertModel<T>): Promise<{ row: InferSelectModel<T>; inserted: boolean }> {
      const result = await call("insertIfAbsent", table, { values }) as { row?: unknown; inserted?: unknown };
      if (!result || typeof result.inserted !== "boolean") throw new StorageError("Respuesta de registro no válida.");
      const row = record<T>(result.row, { idempotencyKey: (values as Record<string, unknown>).idempotencyKey } as Partial<InferInsertModel<T>>);
      if (typeof (row as Record<string, unknown>).referenceCode !== "string" || !(row as Record<string, unknown>).referenceCode) throw new StorageError("El registro no tiene folio.");
      return { row, inserted: result.inserted };
    },
    async countBy<T extends SQLiteTable>(table: T, filters: Partial<InferSelectModel<T>>, field: string): Promise<Array<{ category: string; count: number }>> {
      const result = await call("countBy", table, { filters, field });
      if (!Array.isArray(result)) throw new StorageError("Respuesta de conteo no válida.");
      return result as Array<{ category: string; count: number }>;
    },
  };
}
