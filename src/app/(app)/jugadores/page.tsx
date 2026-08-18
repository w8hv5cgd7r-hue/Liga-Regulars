import Link from "next/link";
import { getActivePlayers } from "@/lib/data/players";

export default async function PlayersPage() {
  const players = await getActivePlayers();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-primary-dark">Jugadores</h1>
      <div className="flex flex-col gap-2">
        {players.map((p) => (
          <Link
            key={p.id}
            href={`/jugadores/${p.id}`}
            className="flex items-center justify-between rounded-lg border border-border bg-card p-3 hover:border-primary"
          >
            <div className="flex items-center gap-3">
              <span
                className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white"
                style={{ backgroundColor: p.avatar_color }}
                aria-hidden
              >
                {p.full_name.charAt(0).toUpperCase()}
              </span>
              <span className="font-medium">{p.full_name}</span>
            </div>
            <span className="text-sm text-muted">Hcp {p.handicap}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
