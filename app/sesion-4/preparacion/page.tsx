import type { Metadata } from "next";
import { SessionFourPrep } from "../../session-four-prep";

export const metadata: Metadata = {
  title: "Preparación S4 · Leer una evidencia antes de opinar | AULA-IA",
  description: "Ruta no acreditable de 60 minutos para reconocer evidencia, criterio, logro y siguiente paso antes de la Sesión 4 principal.",
  openGraph: {
    title: "Preparación S4 · Leer una evidencia antes de opinar",
    description: "Práctica guiada para principiantes antes de la Sesión 4 principal.",
    images: [{ url: "/recursos/sesion-4/og-sesion-4.png", width: 1536, height: 1024, alt: "Preparación de la Sesión 4 de AULA-IA" }],
  },
};

export default function SessionFourPreparationPage() {
  return <SessionFourPrep />;
}
