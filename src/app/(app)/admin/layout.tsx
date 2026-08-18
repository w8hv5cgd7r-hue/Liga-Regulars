import Link from "next/link";
import { requireAdmin } from "@/lib/auth";

const tabs = [
  { href: "/admin", label: "Resumen" },
  { href: "/admin/jugadores", label: "Jugadores" },
  { href: "/admin/campos", label: "Campos" },
  { href: "/admin/temporadas", label: "Temporadas" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-bold text-primary-dark">Administración</h1>
        <p className="text-sm text-muted">Gestiona jugadores, campos y temporadas de la liga.</p>
      </div>
      <nav className="flex gap-1 overflow-x-auto border-b border-border" aria-label="Secciones de administración">
        {tabs.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="whitespace-nowrap rounded-t-md px-3 py-2 text-sm font-medium text-foreground hover:bg-card"
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
