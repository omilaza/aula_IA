import type { Metadata } from "next";
import { SessionFive } from "../session-five";

export const metadata: Metadata = {
  title: "Sesión 5 · Instrumentos y análisis de evidencias con IA | AULA-IA",
  description:
    "Ruta principal de 90 minutos para diseñar instrumentos, analizar 50 resultados ficticios y documentar una decisión docente verificable.",
  openGraph: {
    title: "Sesión 5 · Instrumentos de evaluación y análisis de evidencias con IA",
    description:
      "Dos laboratorios enlazados: construir un instrumento y analizar evidencias ficticias sin inventar causas.",
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

export default function SessionFivePage() {
  return <SessionFive />;
}
