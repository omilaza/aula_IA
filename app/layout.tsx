import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://aula-ia-sesion-1-rdtm-2026.musikamereon.chatgpt.site"),
  title: "Sesión 1 · De la pregunta rápida al trabajo con contexto | AULA-IA",
  description: "Módulo interactivo para docentes: contexto, verificación y práctica crítica con IA generativa en 90 minutos.",
  applicationName: "AULA-IA",
  keywords: ["formación docente", "IA generativa", "prompts", "contexto", "AULA-IA"],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body>
    </html>
  );
}
