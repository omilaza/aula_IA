import type { Metadata } from "next";
import { SessionThree } from "../session-three";

export const metadata: Metadata = {
  title: "Sesión 3 · Diseño de actividades y secuencias didácticas | AULA-IA",
  description: "Ruta principal de 90 minutos para diseñar, revisar y registrar una secuencia didáctica contextualizada con apoyo de IA.",
  openGraph: {
    title: "Sesión 3 · Diseño de secuencias didácticas con IA",
    description: "Propósito, actividad, evidencia y revisión docente en una ruta práctica de 90 minutos.",
    images: [{ url: "/recursos/sesion-3/og-sesion-3.png", width: 1536, height: 1024, alt: "Sesión 3 de AULA-IA: diseño de secuencias didácticas con IA" }],
  },
};

export default function SessionThreePage() {
  return <SessionThree />;
}
