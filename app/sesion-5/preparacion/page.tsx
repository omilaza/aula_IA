import type { Metadata } from "next";
import { SessionFivePrep } from "../../session-five-prep";

export const metadata: Metadata = {
  title: "Preparación S5 · Del criterio a la decisión | AULA-IA",
  description:
    "Ruta guiada de 60 minutos para principiantes: lista de cotejo, ocho resultados ficticios y transición a la Sesión 5 principal.",
  openGraph: {
    title: "Preparación S5 · Del criterio a la decisión",
    description:
      "Nivelación no acreditable antes de la Sesión 5 principal.",
    images: [
      {
        url: "/recursos/sesion-5/hero-instrumentos-evidencias-s5.png",
        width: 1536,
        height: 1024,
        alt: "Docentes relacionan evidencias anónimas, instrumentos de evaluación y un tablero de resultados",
      },
    ],
  },
};

export default function SessionFivePreparationPage() {
  return <SessionFivePrep />;
}
