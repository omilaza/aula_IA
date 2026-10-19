import { env } from "cloudflare:workers";
import { createSheetsRepository } from "./sheets-client";
export { currentTimestamp, increment } from "./sheets-client";

export function getDb() {
  return createSheetsRepository({ url: env.GOOGLE_SHEETS_WEBHOOK_URL, secret: env.GOOGLE_SHEETS_WEBHOOK_SECRET });
}
