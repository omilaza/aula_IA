import styles from "./session-navigation.module.css";

const sessions = [
  { number: 1, href: "/" },
  { number: 2, href: "/sesion-2" },
  { number: 3, href: "/sesion-3" },
  { number: 4, href: "/sesion-4" },
  { number: 5, href: "/sesion-5" },
  { number: 6, href: "/sesion-6" },
] as const;

export default function SessionNavigation({ current, position }: { current: 1 | 2 | 3 | 4 | 5 | 6; position: "top" | "bottom" }) {
  return (
    <nav className={`${styles.navigation} ${styles[position]}`} aria-label={`${position === "top" ? "Navegación superior" : "Navegación final"} entre sesiones`}>
      <strong>Ir a una sesión</strong>
      <div>
        {sessions.map((session) => session.number === current
          ? <span key={session.number} className={styles.current} aria-current="page">Sesión {session.number}<small>Actual</small></span>
          : <a key={session.number} href={session.href}>Sesión {session.number}</a>)}
      </div>
    </nav>
  );
}
