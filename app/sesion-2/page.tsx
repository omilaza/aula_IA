import type { Metadata } from "next";
import { SessionTwo } from "../session-two";

export const metadata: Metadata = {
  title: "Sesión 2 · Documentos, fuentes y contexto pedagógico | AULA-IA",
  description: "Sesión principal de 90 minutos para crear, revisar y registrar un recurso docente fundamentado en una fuente.",
  openGraph: {
    title: "Sesión 2 · Documentos, fuentes y contexto pedagógico",
    description: "90 minutos de demostración, laboratorio, revisión y evidencia docente.",
    images: [{ url: "/og.png", width: 1731, height: 909, alt: "Docente revisando fuentes y un recurso pedagógico asistido por IA" }],
  },
  twitter: { card: "summary_large_image", images: ["/og.png"] },
};

export default function SessionTwoPage() {
  return <SessionTwo />;
}
