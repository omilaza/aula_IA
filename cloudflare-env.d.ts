/// <reference types="@cloudflare/workers-types" />

declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    ASSETS: Fetcher;
    GOOGLE_SHEETS_WEBHOOK_URL?: string;
    GOOGLE_SHEETS_WEBHOOK_SECRET?: string;
    PDF_EXPORT_SECRET?: string;
  }
}
