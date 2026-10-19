import type { Metadata } from "next";
import { SessionSix } from "../session-six";

const title = "Sesión 6 · Integración y producto final | AULA-IA";
const description = "Cierre de 90 minutos para recuperar los productos de las sesiones anteriores, integrar un proyecto didáctico, auditarlo y documentar una decisión docente verificable.";
const image = "/recursos/sesion-6/hero-integracion-producto-final-s6.png";

export const metadata: Metadata = {
  title,
  description,
  openGraph: {
    title,
    description,
    images: [{
      url: image,
      width: 1536,
      height: 1024,
      alt: "Docentes integran contexto, fuentes, secuencia, evaluación e instrumento en un proyecto didáctico final",
    }],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [image],
  },
};

export default function SessionSixPage() {
  return <SessionSix />;
}
