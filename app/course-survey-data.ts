export const ratingLabels = {
  1: "Muy insatisfecho",
  2: "Insatisfecho",
  3: "Aceptable",
  4: "Satisfecho",
  5: "Muy satisfecho",
} as const;

export type RatingValue = 0 | keyof typeof ratingLabels;

export const courseRatingQuestions = [
  {
    key: "generalRating",
    label: "Satisfacción general con el curso",
    description: "Tu valoración global de la experiencia formativa.",
    required: true,
  },
  {
    key: "contentRating",
    label: "Calidad y pertinencia de los contenidos",
    description: "Claridad, actualidad y relación de los temas con tu práctica.",
    required: true,
  },
  {
    key: "instructorRating",
    label: "Desempeño y acompañamiento del instructor",
    description: "Explicaciones, orientación, atención de dudas y acompañamiento.",
    required: true,
  },
  {
    key: "platformRating",
    label: "Utilidad y facilidad de uso de la plataforma",
    description: "Organización, navegación y apoyo de AULA-IA durante el curso.",
    required: true,
  },
  {
    key: "activitiesRating",
    label: "Actividades y prácticas",
    description: "Utilidad de los laboratorios, ejercicios y momentos de aplicación.",
    required: false,
  },
] as const;

export type CourseRatingKey = (typeof courseRatingQuestions)[number]["key"];

export const recommendationOptions = [
  { value: "definitely_yes", label: "Sí, definitivamente" },
  { value: "probably_yes", label: "Probablemente sí" },
  { value: "unsure", label: "Aún no estoy seguro/a" },
  { value: "probably_no", label: "Probablemente no" },
  { value: "definitely_no", label: "No por ahora" },
] as const;

export type RecommendationValue = (typeof recommendationOptions)[number]["value"] | "";
