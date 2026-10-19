"use client";
/* eslint-disable @next/next/no-html-link-for-pages */

import { type FormEvent, useRef, useState } from "react";
import {
  courseRatingQuestions,
  ratingLabels,
  recommendationOptions,
  type CourseRatingKey,
  type RatingValue,
  type RecommendationValue,
} from "./course-survey-data";
import styles from "./course-survey.module.css";

type SurveyForm = Record<CourseRatingKey, RatingValue> & {
  materialsRating: RatingValue;
  materialsNotUsed: boolean;
  recommendationApplication: RecommendationValue;
  likedMost: string;
  improvements: string;
  additionalComments: string;
  name: string;
  email: string;
};

type CriticalKey = "generalRating" | "contentRating" | "instructorRating" | "platformRating";
type IssueKey = CriticalKey | "email";

type ValidationIssue = {
  key: IssueKey;
  fieldId: string;
  label: string;
  message: string;
};

type SubmissionState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "success"; referenceCode: string };

const emptyForm: SurveyForm = {
  generalRating: 0,
  contentRating: 0,
  instructorRating: 0,
  platformRating: 0,
  activitiesRating: 0,
  materialsRating: 0,
  materialsNotUsed: false,
  recommendationApplication: "",
  likedMost: "",
  improvements: "",
  additionalComments: "",
  name: "",
  email: "",
};

const criticalLabels: Record<CriticalKey, string> = {
  generalRating: "Satisfacción general con el curso",
  contentRating: "Calidad y pertinencia de los contenidos",
  instructorRating: "Desempeño y acompañamiento del instructor",
  platformRating: "Utilidad y facilidad de uso de la plataforma",
};

const criticalKeys = Object.keys(criticalLabels) as CriticalKey[];

function collectIssues(form: SurveyForm): ValidationIssue[] {
  const issues: ValidationIssue[] = criticalKeys.flatMap((key) => form[key]
    ? []
    : [{
        key,
        fieldId: `survey-${key}`,
        label: criticalLabels[key],
        message: "Selecciona una valoración de 1 a 5 estrellas.",
      }]);
  const email = form.email.trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    issues.push({
      key: "email",
      fieldId: "survey-email",
      label: "Correo electrónico opcional",
      message: "Revisa el formato del correo o deja el campo vacío.",
    });
  }
  return issues;
}

function preferredScrollBehavior(): ScrollBehavior {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}

function StarRating({
  id,
  name,
  label,
  description,
  value,
  required = false,
  error,
  onChange,
}: {
  id: string;
  name: string;
  label: string;
  description: string;
  value: RatingValue;
  required?: boolean;
  error?: string;
  onChange: (rating: RatingValue) => void;
}) {
  const descriptionId = `${id}-description`;
  const errorId = `${id}-error`;

  return (
    <fieldset
      id={id}
      className={`${styles.ratingCard} ${error ? styles.fieldError : ""}`}
      aria-invalid={Boolean(error)}
      aria-describedby={`${descriptionId}${error ? ` ${errorId}` : ""}`}
      tabIndex={-1}
    >
      <legend>{label}{required ? <span className={styles.requiredMark}>*</span> : <span className={styles.optionalMark}>Opcional</span>}</legend>
      <p id={descriptionId}>{description}</p>
      <div className={styles.starRow} role="radiogroup" aria-label={label} aria-required={required}>
        {([1, 2, 3, 4, 5] as const).map((rating) => (
          <label key={rating} className={value >= rating ? styles.starSelected : ""}>
            <input
              type="radio"
              name={name}
              value={rating}
              checked={value === rating}
              required={required}
              aria-label={`${rating} de 5: ${ratingLabels[rating]}`}
              aria-describedby={`${descriptionId}${error ? ` ${errorId}` : ""}`}
              onChange={() => onChange(rating)}
            />
            <span className={styles.starGlyph} aria-hidden="true">★</span>
            <span className={styles.starNumber}>{rating}</span>
          </label>
        ))}
      </div>
      <p className={styles.ratingSelection} aria-live="polite">
        {value ? `${value} de 5 · ${ratingLabels[value]}` : "Selecciona de 1 a 5 estrellas"}
      </p>
      {error ? <p id={errorId} className={styles.validationMessage}>{error}</p> : null}
    </fieldset>
  );
}

export function CourseSurvey() {
  const [form, setForm] = useState<SurveyForm>(emptyForm);
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [submission, setSubmission] = useState<SubmissionState>({ kind: "idle" });
  const submittingRef = useRef(false);
  const idempotencyKeyRef = useRef("");

  const issueFor = (key: IssueKey) => issues.find((issue) => issue.key === key);

  function focusIssue(issue: ValidationIssue) {
    const field = document.getElementById(issue.fieldId);
    field?.scrollIntoView({ behavior: preferredScrollBehavior(), block: "center" });
    const firstControl = field?.querySelector<HTMLInputElement>('input[type="radio"], input, textarea, select');
    window.setTimeout(() => (firstControl || field)?.focus(), 250);
  }

  function updateRating(key: CourseRatingKey, value: RatingValue) {
    setForm((current) => ({ ...current, [key]: value }));
    setIssues((current) => current.filter((issue) => issue.key !== key));
    if (submission.kind === "error") setSubmission({ kind: "idle" });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current || submission.kind === "loading" || submission.kind === "success") return;

    const nextIssues = collectIssues(form);
    setIssues(nextIssues);
    if (nextIssues.length) {
      setSubmission({ kind: "error", message: "Revisa los campos indicados antes de enviar la encuesta." });
      focusIssue(nextIssues[0]);
      return;
    }

    submittingRef.current = true;
    setSubmission({ kind: "loading" });

    try {
      if (!idempotencyKeyRef.current) idempotencyKeyRef.current = crypto.randomUUID();
      const response = await fetch("/api/course-survey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submit",
          idempotencyKey: idempotencyKeyRef.current,
          generalRating: form.generalRating,
          contentRating: form.contentRating,
          instructorRating: form.instructorRating,
          platformRating: form.platformRating,
          activitiesRating: form.activitiesRating || null,
          materialsRating: form.materialsNotUsed ? null : form.materialsRating || null,
          materialsNotUsed: form.materialsNotUsed,
          recommendationApplication: form.recommendationApplication,
          likedMost: form.likedMost.trim(),
          improvements: form.improvements.trim(),
          additionalComments: form.additionalComments.trim(),
          name: form.name.trim(),
          email: form.email.trim(),
        }),
      });
      const payload = await response.json() as {
        ok?: boolean;
        referenceCode?: string;
        message?: string;
        error?: string;
        issues?: Array<{ field?: string; message?: string }>;
      };
      if (!response.ok || !payload.ok || !payload.referenceCode) {
        const mappedIssues = (payload.issues || []).flatMap((issue): ValidationIssue[] => {
          if (!issue.field || !(issue.field in { ...criticalLabels, email: true })) return [];
          const key = issue.field as IssueKey;
          return [{
            key,
            fieldId: key === "email" ? "survey-email" : `survey-${key}`,
            label: key === "email" ? "Correo electrónico opcional" : criticalLabels[key as CriticalKey],
            message: issue.message || "Revisa este campo.",
          }];
        });
        if (mappedIssues.length) {
          setIssues(mappedIssues);
          setSubmission({ kind: "error", message: payload.error || "Revisa los campos indicados antes de enviar la encuesta." });
          focusIssue(mappedIssues[0]);
          return;
        }
        throw new Error(payload.error || payload.message || "No fue posible registrar la encuesta en este momento.");
      }
      setSubmission({ kind: "success", referenceCode: payload.referenceCode });
      window.scrollTo({ top: 0, behavior: preferredScrollBehavior() });
    } catch (error) {
      setSubmission({
        kind: "error",
        message: error instanceof Error ? error.message : "No fue posible registrar la encuesta. Intenta nuevamente.",
      });
    } finally {
      submittingRef.current = false;
    }
  }

  if (submission.kind === "success") {
    return (
      <main className={styles.shell}>
        <section className={styles.confirmation} aria-labelledby="survey-confirmation-title" role="status">
          <a className={styles.brand} href="/"><span>IA</span><span><strong>AULA-IA</strong><small>Formación docente</small></span></a>
          <span className={styles.confirmationIcon} aria-hidden="true">✓</span>
          <p className={styles.eyebrow}>Encuesta registrada</p>
          <h1 id="survey-confirmation-title">Gracias por compartir tu experiencia.</h1>
          <p>Tu opinión quedó registrada y se analizará de forma agregada para mejorar futuras ediciones del curso.</p>
          <div className={styles.referenceBox}><span>Folio de respuesta</span><strong>{submission.referenceCode}</strong><small>Este folio confirma la recepción de la encuesta. No constituye acreditación ni comprobante académico.</small></div>
          <div className={styles.actionRow}><a className={styles.primaryButton} href="/sesion-6">Volver a la Sesión 6</a><a className={styles.secondaryButton} href="/">Ir al inicio de AULA-IA</a></div>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.shell}>
      <a className={styles.skipLink} href="#encuesta">Saltar a la encuesta</a>
      <header className={styles.topbar}>
        <a className={styles.brand} href="/"><span>IA</span><span><strong>AULA-IA</strong><small>Formación docente</small></span></a>
        <nav aria-label="Regresar al curso"><a href="/sesion-5">Sesión 5</a><a href="/sesion-6">Sesión 6</a></nav>
      </header>

      <section className={styles.hero} aria-labelledby="survey-title">
        <div>
          <p className={styles.eyebrow}>Cierre del curso · 3–5 minutos</p>
          <h1 id="survey-title">Encuesta de satisfacción del curso</h1>
          <p className={styles.lede}>Tu experiencia nos ayuda a reconocer lo que funciona y a mejorar contenidos, acompañamiento, actividades y recursos.</p>
        </div>
        <aside className={styles.heroCard} aria-label="Características de la encuesta">
          <strong>Respuesta anónima por defecto</strong>
          <p>El nombre y el correo son opcionales. Puedes agregarlos únicamente si deseas que el equipo dé seguimiento a tu comentario.</p>
          <span>No forma parte de la acreditación</span>
        </aside>
      </section>

      <form id="encuesta" className={styles.form} onSubmit={handleSubmit} noValidate>
        <section className={styles.section} aria-labelledby="ratings-title">
          <div className={styles.sectionHeading}>
            <p className={styles.eyebrow}>Valoración del curso</p>
            <h2 id="ratings-title">Califica tu experiencia</h2>
            <p>Las cuatro preguntas marcadas con * son indispensables. En las demás puedes responder solo si corresponde.</p>
          </div>

          {issues.length ? (
            <div className={styles.validationSummary} role="alert" aria-live="assertive">
              <h3>Hay {issues.length} {issues.length === 1 ? "campo" : "campos"} por revisar</h3>
              <p>Selecciona cada elemento para ir directamente a la pregunta pendiente.</p>
              <ol>{issues.map((issue) => <li key={issue.key}><button type="button" onClick={() => focusIssue(issue)}><strong>{issue.label}</strong><span>{issue.message}</span></button></li>)}</ol>
              <button className={styles.secondaryButton} type="button" onClick={() => focusIssue(issues[0])}>Ir a la primera pregunta pendiente</button>
            </div>
          ) : null}

          <div className={styles.ratingGrid}>
            {courseRatingQuestions.map((question) => (
              <StarRating
                key={question.key}
                id={`survey-${question.key}`}
                name={question.key}
                label={question.label}
                description={question.description}
                value={form[question.key]}
                required={question.required}
                error={question.required ? issueFor(question.key as CriticalKey)?.message : undefined}
                onChange={(rating) => updateRating(question.key, rating)}
              />
            ))}

            <fieldset className={styles.ratingCard}>
              <legend>Materiales descargables, presentaciones y recursos de apoyo <span className={styles.optionalMark}>Opcional</span></legend>
              <p>Valora los materiales que consultaste durante el curso.</p>
              <label className={styles.notApplicable}>
                <input type="checkbox" checked={form.materialsNotUsed} onChange={(event) => setForm((current) => ({ ...current, materialsNotUsed: event.target.checked, materialsRating: event.target.checked ? 0 : current.materialsRating }))} />
                <span>No los utilicé / No aplica</span>
              </label>
              {!form.materialsNotUsed ? (
                <div className={styles.starRow} role="radiogroup" aria-label="Materiales descargables, presentaciones y recursos de apoyo">
                  {([1, 2, 3, 4, 5] as const).map((rating) => (
                    <label key={rating} className={form.materialsRating >= rating ? styles.starSelected : ""}>
                      <input type="radio" name="materialsRating" value={rating} checked={form.materialsRating === rating} aria-label={`${rating} de 5: ${ratingLabels[rating]}`} onChange={() => setForm((current) => ({ ...current, materialsRating: rating }))} />
                      <span className={styles.starGlyph} aria-hidden="true">★</span><span className={styles.starNumber}>{rating}</span>
                    </label>
                  ))}
                </div>
              ) : null}
              <p className={styles.ratingSelection} aria-live="polite">{form.materialsNotUsed ? "No los utilicé / No aplica" : form.materialsRating ? `${form.materialsRating} de 5 · ${ratingLabels[form.materialsRating]}` : "Selecciona de 1 a 5 estrellas si utilizaste estos recursos"}</p>
            </fieldset>
          </div>
        </section>

        <section className={`${styles.section} ${styles.lightSection}`} aria-labelledby="application-title">
          <div className={styles.sectionHeading}>
            <p className={styles.eyebrow}>Transferencia</p>
            <h2 id="application-title">¿Recomendarías el curso o aplicarías lo aprendido?</h2>
            <p>Selecciona la opción que mejor represente tu intención actual. Esta pregunta es opcional.</p>
          </div>
          <fieldset className={styles.recommendationGroup}>
            <legend className={styles.visuallyHidden}>Intención de recomendar el curso o aplicar lo aprendido</legend>
            {recommendationOptions.map((option) => <label key={option.value}><input type="radio" name="recommendationApplication" value={option.value} checked={form.recommendationApplication === option.value} onChange={() => setForm((current) => ({ ...current, recommendationApplication: option.value }))} /><span>{option.label}</span></label>)}
          </fieldset>
        </section>

        <section className={styles.section} aria-labelledby="comments-title">
          <div className={styles.sectionHeading}>
            <p className={styles.eyebrow}>Tu experiencia</p>
            <h2 id="comments-title">Cuéntanos con tus palabras</h2>
            <p>Estas preguntas son opcionales. Puedes responder una, varias o ninguna.</p>
          </div>
          <div className={styles.textGrid}>
            <label>¿Qué fue lo que más te gustó y por qué?<textarea rows={5} maxLength={2000} value={form.likedMost} onChange={(event) => setForm((current) => ({ ...current, likedMost: event.target.value }))} /></label>
            <label>¿Qué mejorarías y por qué?<textarea rows={5} maxLength={2000} value={form.improvements} onChange={(event) => setForm((current) => ({ ...current, improvements: event.target.value }))} /></label>
            <label className={styles.fullWidth}>Comentarios u observaciones adicionales<textarea rows={4} maxLength={2000} value={form.additionalComments} onChange={(event) => setForm((current) => ({ ...current, additionalComments: event.target.value }))} /></label>
          </div>
        </section>

        <section className={`${styles.section} ${styles.followUpSection}`} aria-labelledby="follow-up-title">
          <div className={styles.sectionHeading}>
            <p className={styles.eyebrow}>Seguimiento opcional</p>
            <h2 id="follow-up-title">¿Deseas identificar tu respuesta?</h2>
            <p>Puedes dejar ambos campos vacíos. Solo se usarán si deseas que el equipo dé seguimiento a tu comentario.</p>
          </div>
          <div className={styles.contactGrid}>
            <label>Nombre <span>Opcional</span><input autoComplete="name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /></label>
            <label id="survey-email" className={issueFor("email") ? styles.contactError : ""}>Correo electrónico <span>Opcional</span><input type="email" autoComplete="email" inputMode="email" aria-invalid={Boolean(issueFor("email"))} aria-describedby={issueFor("email") ? "survey-email-error" : undefined} value={form.email} onChange={(event) => { setForm((current) => ({ ...current, email: event.target.value })); setIssues((current) => current.filter((issue) => issue.key !== "email")); if (submission.kind === "error") setSubmission({ kind: "idle" }); }} />{issueFor("email") ? <span id="survey-email-error" className={styles.validationMessage}>{issueFor("email")?.message}</span> : null}</label>
          </div>
          <p className={styles.privacyNote}><strong>Privacidad:</strong> no solicites ni incluyas datos sensibles. Las respuestas se usarán de forma agregada para evaluar y mejorar el curso. Nombre y correo son opcionales y se utilizarán únicamente para seguimiento, si los proporcionas.</p>

          {submission.kind === "error" ? <p className={styles.submitError} role="alert">{submission.message}</p> : null}
          <div className={styles.submitRow}>
            <p>Al enviar confirmas que tu opinión puede analizarse para fines de mejora del curso. Esta encuesta no otorga acreditación.</p>
            <button className={styles.primaryButton} type="submit" disabled={submission.kind === "loading"}>{submission.kind === "loading" ? "Registrando opinión…" : "Enviar encuesta"}</button>
          </div>
        </section>
      </form>

      <footer className={styles.footer}><strong>AULA-IA · Red de Docentes Transdisciplinares</strong><span>Encuesta de satisfacción del curso</span></footer>
    </main>
  );
}
