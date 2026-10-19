import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

async function pdfModule() {
  const source = (await read("../app/evidence-pdf-server.ts"))
    .replace('import { env } from "cloudflare:workers";', "const env = {};");
  const javascript = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(javascript).toString("base64")}`);
}

function fixtureDocument(session) {
  return {
    session,
    title: `Sesión ${session.slice(1)} - Evidencia principal`,
    savedAt: `2026-08-${String(Number(session.slice(1)) + 10).padStart(2, "0")} 12:00:00`,
    confirmationCode: `EV${session.slice(1)}-FOLIO-PRUEBA`,
    participant: [
      { label: "Nombre", value: "Participante de prueba" },
      { label: "Correo", value: "participante@example.mx" },
    ],
    sections: [
      {
        title: "Producto docente",
        fields: [
          { label: "Propósito", value: "Evidencia ficticia para comprobar la composición del PDF." },
          { label: "Decisión docente", value: "Revisar, adaptar y documentar el seguimiento." },
        ],
      },
    ],
  };
}

test("central recovery uses POST, exact normalized email and read-only principal S1-S5 records", async () => {
  const [portfolioRoute, evidenceRoute] = await Promise.all([
    read("../app/api/portfolio-pdf/route.ts"),
    read("../app/api/evidence-pdf/route.ts"),
  ]);
  assert.match(portfolioRoute, /export async function POST/);
  assert.doesNotMatch(portfolioRoute, /export async function GET/);
  assert.match(portfolioRoute, /trim\(\)\.slice\(0, max\)/);
  assert.match(portfolioRoute, /\.toLowerCase\(\)/);
  assert.match(portfolioRoute, /loadEvidenceDocument\(session, email\)/);
  assert.match(evidenceRoute, /primaryEvidenceSessions = \["S1", "S2", "S3", "S4", "S5"\]/);
  for (const table of ["sessionTwoEvidence", "sessionThreeEvidence", "sessionFourEvidence"]) {
    assert.match(evidenceRoute, new RegExp(`db\\.find\\(\\s*${table},\\s*\\{[^}]+route: "principal", activity: "evidencia-principal"`));
  }
  assert.doesNotMatch(portfolioRoute, /S5P/);
  assert.doesNotMatch(portfolioRoute, /\.insert\(|\.update\(|\.delete\(|syncToInstitutionalSheet|localStorage/);
});

test("portfolio responses remain private and inputs never travel in a query string", async () => {
  const route = await read("../app/api/portfolio-pdf/route.ts");
  assert.match(route, /"Cache-Control": "private, no-store"/);
  assert.match(route, /"Cross-Origin-Resource-Policy": "same-origin"/);
  assert.match(route, /"X-Robots-Tag": "noindex, nofollow, noarchive"/);
  assert.match(route, /new URL\(origin\)\.host === host/);
  assert.match(route, /request\.text\(\)/);
  assert.match(route, /raw\.length > 4_096/);
  assert.doesNotMatch(route, /URLSearchParams|searchParams|request\.url|payload\.code|confirmationCode/);
});

test("individual recovery keeps its strong credential check after sharing the read-only loaders", async () => {
  const route = await read("../app/api/evidence-pdf/route.ts");
  assert.match(route, /export async function loadEvidenceDocument/);
  assert.match(route, /verifyPdfAccessCode\(session, email, document\.confirmationCode, code\)/);
  assert.match(route, /if \(!document \|\| !\(await verifyPdfAccessCode/);
});

test("Session 6 individual PDF reads its latest principal product without entering the S1-S5 portfolio", async () => {
  const [route, component] = await Promise.all([
    read("../app/api/evidence-pdf/route.ts"),
    read("../app/evidence-pdf-download.tsx"),
  ]);
  const start = route.indexOf("async function sessionSixDocument");
  const end = route.indexOf("export async function loadEvidenceDocument", start);
  const block = route.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.match(block, /db\.find\(\s*sessionSixEvidence,/s);
  assert.match(block, /activity: "evidencia-principal"/);
  assert.match(block, /orderBy: "updatedAt", descending: true, limit: 1/);
  for (const field of [
    "projectTitle", "teachingNeed", "educationalLevel", "subject", "pedagogicalContext",
    "learningPurpose", "sourceTraceability", "prompt", "activitySequence", "assessmentEvidence",
    "instrumentCriteria", "analysisLimits", "teacherDecision", "followUpEvidence", "adaptation",
    "aiContribution", "teacherReview", "implementationStep", "checklistJson",
  ]) {
    assert.match(block, new RegExp(`evidence\\.${field}\\b`));
  }
  assert.match(component, /"S5" \| "S6"/);
  assert.doesNotMatch(route.match(/primaryEvidenceSessions = \[[^\]]+\]/)?.[0] || "", /S6/);
});

test("Session 6 recovery UI asks for one email and offers five individual files plus one portfolio", async () => {
  const component = await read("../app/portfolio-recovery.tsx");
  assert.match(component, /type="email"/);
  assert.match(component, /initialEmail\?: string/);
  assert.match(component, /const email = typedEmail \|\| initialEmail\.trim\(\)/);
  assert.match(component, /searchedEmail === normalizedEmail/);
  assert.match(component, /email: searchedEmail/);
  assert.match(component, /Buscar mis trabajos/);
  assert.match(component, /sessionOrder: PrimarySession\[\] = \["S1", "S2", "S3", "S4", "S5"\]/);
  assert.match(component, /Descargar PDF/);
  assert.match(component, /Descargar portafolio completo/);
  assert.match(component, /action: "search"/);
  assert.match(component, /action: "download"/);
  assert.doesNotMatch(component, /código de descarga|payload\.code|localStorage|searchParams/i);
});

test("portfolio PDF has an institutional cover, index, folios and a new page for every session", async () => {
  const server = await read("../app/evidence-pdf-server.ts");
  assert.match(server, /PORTAFOLIO INSTITUCIONAL DE EVIDENCIAS/);
  assert.match(server, /ÍNDICE DE EVIDENCIAS/);
  assert.match(server, /Folio: \$\{entry\.document\.confirmationCode\}/);
  assert.match(server, /documentPages\.map/);

  const { buildEvidencePortfolioPdf } = await pdfModule();
  const documents = ["S1", "S2", "S3", "S4", "S5"].map(fixtureDocument);
  const pdf = buildEvidencePortfolioPdf({
    email: "participante@example.mx",
    generatedAt: "2026-08-19T12:00:00.000Z",
    documents,
  });
  const text = Buffer.from(pdf).toString("latin1");
  assert.match(text, /^%PDF-1\.4/);
  assert.match(text, /\/Count 7/);
  assert.equal((text.match(/\/Type \/Page\b/g) || []).length, 7);
  const firstEvidenceIndex = Buffer.from("Sesión: S1 · Página inicial: 3", "latin1").toString("hex");
  assert.ok(text.includes(`<${firstEvidenceIndex}>`), "el índice debe apuntar la primera evidencia a la página 3");
  assert.match(text, /%%EOF\n$/);
});
