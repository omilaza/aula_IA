import type { Metadata } from "next";
import { CourseSurvey } from "../course-survey";

const title = "Encuesta de satisfacción del curso | AULA-IA";
const description = "Encuesta anónima de 3 a 5 minutos para valorar el curso completo AULA-IA, sus contenidos, acompañamiento, plataforma, actividades y materiales.";

export const metadata: Metadata = {
  title,
  description,
  openGraph: {
    title,
    description,
    images: [],
  },
  twitter: {
    card: "summary",
    title,
    description,
    images: [],
  },
};

export default function CourseSurveyPage() {
  return <CourseSurvey />;
}
