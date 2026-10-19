import type { Metadata } from "next";
import { SessionFour } from "../session-four";

export const metadata: Metadata = {
  title: "Sesión 4 · Evaluación y retroalimentación con IA | AULA-IA",
  description: "Ruta principal de 90 minutos para analizar evidencias, producir retroalimentación revisable y registrar la decisión docente.",
  openGraph: {
    title: "Sesión 4 · Evaluar para abrir el siguiente paso",
    description: "Evaluación, evidencia, retroalimentación y decisión docente en una ruta práctica de 90 minutos.",
    images: [{ url: "/recursos/sesion-4/og-sesion-4.png", width: 1536, height: 1024, alt: "Sesión 4 de AULA-IA: evidencia, retroalimentación y decisión docente" }],
  },
};

export default function SessionFourPage() {
  return <SessionFour />;
}
