import Link from "next/link";
import { requireActivePlayer } from "@/lib/auth";
import { signOutAction } from "@/lib/actions/auth-actions";

export default async function ProfilePage() {
  const player = await requireActivePlayer();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <span
          className="flex h-14 w-14 items-center justify-center rounded-full text-xl font-bold text-white"
          style={{ backgroundColor: player.avatar_color }}
          aria-hidden
        >
          {player.full_name.charAt(0).toUpperCase()}
        </span>
        <div>
          <h1 className="text-xl font-bold text-primary-dark">{player.full_name}</h1>
          <p className="text-sm text-muted">{player.email}</p>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-4 text-sm">
        <p>
          <span className="text-muted">Hándicap actual:</span> <strong>{player.handicap}</strong>
        </p>
        <p className="mt-1">
          <span className="text-muted">Rol:</span>{" "}
          <strong>{player.role === "admin" ? "Administrador" : "Jugador"}</strong>
        </p>
        <p className="mt-2 text-xs text-muted">
          ¿Ha cambiado tu hándicap? Pídele al administrador que lo actualice en Admin → Jugadores.
        </p>
      </div>

      <Link
        href={`/jugadores/${player.id}`}
        className="rounded-md border border-border bg-card px-4 py-2.5 text-center text-sm font-medium hover:border-primary"
      >
        Ver mis estadísticas
      </Link>

      {player.role === "admin" && (
        <Link
          href="/admin"
          className="rounded-md border border-accent/40 bg-accent/10 px-4 py-2.5 text-center text-sm font-medium text-accent"
        >
          Panel de administración
        </Link>
      )}

      <form action={signOutAction}>
        <button
          type="submit"
          className="w-full rounded-md border border-border px-4 py-2.5 text-sm font-medium hover:bg-card"
        >
          Cerrar sesión
        </button>
      </form>
    </div>
  );
}
