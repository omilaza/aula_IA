import type { Metadata } from "next";
import { SessionTwoPrep } from "../../session-two-prep";

export const metadata: Metadata = {
  title: "Preparación Sesión 2 · Paso a paso | AULA-IA",
  description: "Ruta opcional de 60 minutos para practicar pestañas, copiar, pegar, revisar y guardar antes de la Sesión 2 principal.",
  openGraph: {
    title: "Preparación Sesión 2 · Paso a paso",
    description: "Una hora opcional para practicar navegación, copiar, pegar, revisar y guardar.",
    images: [{ url: "/og.png", width: 1731, height: 909, alt: "Docente revisando fuentes y un recurso pedagógico asistido por IA" }],
  },
  twitter: { card: "summary_large_image", images: ["/og.png"] },
};

export default function SessionTwoPreparationPage() {
  return <SessionTwoPrep />;
}
