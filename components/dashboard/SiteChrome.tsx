import Link from "next/link";
import type { ReactNode } from "react";

const navItems = [
  { href: "/dashboard", label: "Overview" },
  { href: "/training-log", label: "Training Log" },
  { href: "/strength", label: "Strength" },
  { href: "/cardio", label: "Cardio" },
  { href: "/recovery", label: "Recovery" },
  { href: "/data-health", label: "Data Health" }
];

export function SiteChrome({
  eyebrow,
  title,
  description,
  compact = false,
  children
}: {
  eyebrow: string;
  title: string;
  description: string;
  compact?: boolean;
  children: ReactNode;
}) {
  return (
    <main className="shell">
      <div className="page">
        <header className={compact ? "topbar topbar-compact" : "topbar"}>
          <div className="brand">
            <p className="eyebrow">{eyebrow}</p>
            <h1>{title}</h1>
            <p className="muted">{description}</p>
          </div>
          <nav className="nav" aria-label="Dashboard navigation">
            {navItems.map((item) => (
              <Link href={item.href} key={item.href}>
                {item.label}
              </Link>
            ))}
          </nav>
        </header>
        {children}
        <footer className="site-footer">
          <Link href="/privacy">Privacy</Link>
        </footer>
      </div>
    </main>
  );
}
