"use client";

import { type FormEvent, useState } from "react";
import styles from "./portfolio-recovery.module.css";

type PrimarySession = "S1" | "S2" | "S3" | "S4" | "S5";
type SessionAvailability = {
  session: PrimarySession;
  label: string;
  available: boolean;
};
type Status = {
  kind: "idle" | "loading" | "success" | "error";
  message?: string;
};

const sessionOrder: PrimarySession[] = ["S1", "S2", "S3", "S4", "S5"];
const defaultSessions: SessionAvailability[] = sessionOrder.map((session, index) => ({
  session,
  label: `Sesión ${index + 1}`,
  available: false,
}));

type Props = {
  initialEmail?: string;
};

async function errorMessage(response: Response) {
  const result = (await response.json().catch(() => ({}))) as { error?: string };
  return result.error || "No fue posible recuperar las evidencias con este correo.";
}

export default function PortfolioRecovery({ initialEmail = "" }: Props) {
  const [typedEmail, setTypedEmail] = useState("");
  const [sessions, setSessions] = useState<SessionAvailability[] | null>(null);
  const [searchedEmail, setSearchedEmail] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [downloadTarget, setDownloadTarget] = useState<PrimarySession | "ALL" | null>(null);
  const email = typedEmail || initialEmail.trim();
  const normalizedEmail = email.trim().toLowerCase();
  const visibleSessions = sessions && searchedEmail === normalizedEmail ? sessions : null;

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus({ kind: "loading", message: "Buscando tus evidencias guardadas…" });
    setSessions(null);
    setSearchedEmail("");
    try {
      const response = await fetch("/api/portfolio-pdf", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "search", email }),
      });
      if (!response.ok) throw new Error(await errorMessage(response));
      const result = (await response.json()) as {
        sessions?: SessionAvailability[];
        availableCount?: number;
      };
      const found = defaultSessions.map((fallback) =>
        result.sessions?.find((item) => item.session === fallback.session) ?? fallback,
      );
      const count = found.filter((item) => item.available).length;
      setSessions(found);
      setSearchedEmail(normalizedEmail);
      setStatus({
        kind: "success",
        message: count
          ? `Encontramos ${count} ${count === 1 ? "evidencia principal" : "evidencias principales"} con este correo.`
          : "No localizamos evidencias principales con este correo. Revisa que sea el mismo que usaste al guardar.",
      });
    } catch (error) {
      setSessions(defaultSessions);
      setSearchedEmail(normalizedEmail);
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "No fue posible recuperar las evidencias.",
      });
    }
  }

  async function download(target: PrimarySession | "ALL") {
    if (!searchedEmail) return;
    setDownloadTarget(target);
    setStatus({
      kind: "loading",
      message: target === "ALL" ? "Preparando tu portafolio completo…" : `Preparando la evidencia de ${target}…`,
    });
    try {
      const response = await fetch("/api/portfolio-pdf", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "download", email: searchedEmail, target }),
      });
      if (!response.ok) throw new Error(await errorMessage(response));
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = target === "ALL" ? "AULA-IA_Portafolio_S1-S5.pdf" : `AULA-IA_${target}_Evidencia.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
      setStatus({
        kind: "success",
        message: target === "ALL" ? "Portafolio descargado." : `Evidencia de ${target} descargada.`,
      });
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "No fue posible preparar la descarga.",
      });
    } finally {
      setDownloadTarget(null);
    }
  }

  const availableCount = visibleSessions?.filter((session) => session.available).length ?? 0;

  return (
    <section className={styles.panel} aria-labelledby="portfolio-recovery-title">
      <div className={styles.heading}>
        <span>Recuperación de archivos</span>
        <h2 id="portfolio-recovery-title">Descarga tus trabajos de las sesiones 1 a 5</h2>
        <p>
          Escribe el mismo correo que usaste al guardar tus evidencias. La búsqueda no modifica ni vuelve a enviar tus trabajos.
        </p>
      </div>

      <form className={styles.search} onSubmit={search}>
        <label htmlFor="portfolio-email">Correo electrónico</label>
        <div className={styles.searchRow}>
          <input
            id="portfolio-email"
            required
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => {
              setTypedEmail(event.target.value);
              setSessions(null);
              setSearchedEmail("");
              setStatus({ kind: "idle" });
            }}
            placeholder="nombre@ejemplo.mx"
          />
          <button type="submit" disabled={status.kind === "loading" || Boolean(downloadTarget)}>
            {status.kind === "loading" && !downloadTarget ? "Buscando…" : "Buscar mis trabajos"}
          </button>
        </div>
      </form>

      {visibleSessions ? (
        <>
          <div className={styles.cards} aria-label="Evidencias localizadas">
            {visibleSessions.map((item) => (
              <article className={item.available ? styles.available : styles.missing} key={item.session}>
                <div>
                  <span>{item.session}</span>
                  <h3>{item.label}</h3>
                  <p>{item.available ? "Evidencia principal disponible" : "No localizada con este correo"}</p>
                </div>
                <button
                  type="button"
                  disabled={!item.available || Boolean(downloadTarget)}
                  onClick={() => void download(item.session)}
                >
                  {downloadTarget === item.session ? "Preparando…" : "Descargar PDF"}
                </button>
              </article>
            ))}
          </div>

          <div className={styles.portfolioAction}>
            <div>
              <strong>Portafolio AULA-IA</strong>
              <p>Integra en un solo PDF las evidencias principales disponibles, con fechas y folios.</p>
            </div>
            <button
              type="button"
              disabled={!availableCount || Boolean(downloadTarget)}
              onClick={() => void download("ALL")}
            >
              {downloadTarget === "ALL" ? "Preparando portafolio…" : "Descargar portafolio completo"}
            </button>
          </div>
        </>
      ) : null}

      <p className={styles.note}>
        Se incluyen solamente las evidencias principales guardadas. La preparación de la Sesión 5 permanece separada.
      </p>
      {status.message ? (
        <p className={`${styles.status} ${status.kind === "error" ? styles.statusError : ""}`} role="status" aria-live="polite">
          {status.message}
        </p>
      ) : null}
    </section>
  );
}
