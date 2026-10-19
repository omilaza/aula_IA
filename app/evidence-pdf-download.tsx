"use client";

import { type FormEvent, useState } from "react";
import styles from "./evidence-pdf-download.module.css";

type Props = {
  session: "S1" | "S2" | "S3" | "S4" | "S5P" | "S5" | "S6";
  email?: string;
  pdfAccessCode?: string;
};

type Status = { kind: "idle" | "loading" | "success" | "error"; message?: string };

export default function EvidencePdfDownload({ session, email = "", pdfAccessCode = "" }: Props) {
  const [recoveryEmail, setRecoveryEmail] = useState<string | null>(null);
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [copied, setCopied] = useState(false);

  async function download(targetEmail: string, targetCode: string) {
    setStatus({ kind: "loading", message: "Preparando el PDF desde tu registro guardado…" });
    try {
      const response = await fetch("/api/evidence-pdf", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ session, email: targetEmail, code: targetCode }),
      });
      if (!response.ok) {
        const result = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(result.error || "No fue posible recuperar el comprobante.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `AULA-IA_${session}_Evidencia.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
      setStatus({ kind: "success", message: "PDF generado desde la evidencia guardada." });
    } catch (error) {
      setStatus({ kind: "error", message: error instanceof Error ? error.message : "No fue posible recuperar el comprobante." });
    }
  }

  async function copyCode() {
    if (!pdfAccessCode) return;
    try {
      await navigator.clipboard.writeText(pdfAccessCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  function handleRecovery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void download(recoveryEmail ?? email, recoveryCode ?? pdfAccessCode);
  }

  return (
    <section className={styles.panel} aria-labelledby={`pdf-title-${session}`}>
      <h3 id={`pdf-title-${session}`}>Comprobante PDF de tu evidencia</h3>
      {pdfAccessCode ? (
        <>
          <p>Tu evidencia ya fue guardada. Descarga una copia construida desde el registro confirmado.</p>
          <code className={styles.code}>{pdfAccessCode}</code>
          <div className={styles.actions}>
            <button className={styles.primary} type="button" disabled={status.kind === "loading"} onClick={() => void download(email, pdfAccessCode)}>
              {status.kind === "loading" ? "Preparando PDF…" : "Descargar mi evidencia en PDF"}
            </button>
            <button className={styles.secondary} type="button" onClick={() => void copyCode()}>{copied ? "Código copiado" : "Copiar código de descarga"}</button>
          </div>
          <p>Conserva este código. Si vuelves a enviar la evidencia, el código nuevo sustituirá al anterior.</p>
        </>
      ) : (
        <p>El botón de descarga aparece después de que la evidencia acreditable queda guardada.</p>
      )}
      <details className={styles.recovery}>
        <summary>Recuperar mi PDF con correo y código</summary>
        <form className={styles.form} onSubmit={handleRecovery}>
          <label>Correo usado en la sesión<input required type="email" autoComplete="email" value={recoveryEmail ?? email} onChange={(event) => setRecoveryEmail(event.target.value)} /></label>
          <label>Código de descarga PDF<input required minLength={45} autoComplete="off" value={recoveryCode ?? pdfAccessCode} onChange={(event) => setRecoveryCode(event.target.value)} placeholder={`PDF${session.slice(1)}-…`} /></label>
          <button className={styles.primary} type="submit" disabled={status.kind === "loading"}>{status.kind === "loading" ? "Comprobando…" : "Recuperar PDF"}</button>
        </form>
      </details>
      {status.message ? <p className={styles.status} role="status">{status.message}</p> : null}
    </section>
  );
}
