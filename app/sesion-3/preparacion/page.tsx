import type { Metadata } from "next";
import { SessionThreePrep } from "../../session-three-prep";

export const metadata: Metadata = {
  title: "Preparación S3 · Primera secuencia paso a paso | AULA-IA",
  description: "Ruta de preparación no acreditable de 60 minutos para distinguir propósito, actividad y evidencia antes de la Sesión 3 principal.",
};

export default function SessionThreePreparationPage() {
  return <SessionThreePrep />;
}
