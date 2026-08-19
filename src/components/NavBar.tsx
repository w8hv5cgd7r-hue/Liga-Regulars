import Link from "next/link";
import { signOutAction } from "@/lib/actions/auth-actions";
import type { Player } from "@/lib/types";
import { LayoutDashboard, ListPlus, Trophy, User, ShieldCheck, UserCircle } from "lucide-react";

const links = [
  { href: "/", label: "Inicio", icon: LayoutDashboard },
  { href: "/rounds", label: "Partidas", icon: ListPlus },
  { href: "/clasificaciones", label: "Clasific.", icon: Trophy },
  { href: "/jugadores", label: "Jugadores", icon: User },
];

export function NavBar({ player }: { player: Player }) {
  return (
    <>
      {/* Cabecera superior (visible en todos los tamaños) */}
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2 font-bold text-primary-dark">
            <span className="text-xl" aria-hidden>
              ⛳
            </span>
            <span>Liga Regulars</span>
          </Link>
          <nav className="hidden items-center gap-1 sm:flex" aria-label="Navegación principal">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-background"
              >
                {l.label}
              </Link>
            ))}
            {player.role === "admin" && (
              <Link
                href="/admin"
                className="flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium text-accent hover:bg-background"
              >
                <ShieldCheck size={16} /> Admin
              </Link>
            )}
          </nav>
          <div className="hidden items-center gap-3 sm:flex">
            <Link href="/perfil" className="text-sm text-muted hover:text-foreground">
              {player.full_name}
            </Link>
            <form action={signOutAction}>
              <button
                type="submit"
                className="rounded-md border border-border px-3 py-2 text-sm hover:bg-background"
              >
                Salir
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Barra inferior para móvil */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card sm:hidden"
        aria-label="Navegación principal"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="grid grid-cols-5">
          {links.map((l) => {
            const Icon = l.icon;
            return (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="flex flex-col items-center gap-0.5 py-2 text-[11px] text-foreground"
                >
                  <Icon size={20} />
                  {l.label}
                </Link>
              </li>
            );
          })}
          <li>
            <Link
              href="/perfil"
              className="flex flex-col items-center gap-0.5 py-2 text-[11px] text-foreground"
            >
              <UserCircle size={20} />
              Perfil
            </Link>
          </li>
        </ul>
      </nav>
    </>
  );
}
