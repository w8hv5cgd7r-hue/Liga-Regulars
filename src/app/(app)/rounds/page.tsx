import Link from "next/link";
import { getRounds } from "@/lib/data/rounds";
import { formatDateEs } from "@/lib/format";

export default async function RoundsPage() {
  const rounds = await getRounds();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-primary-dark">Partidas</h1>
        <Link
          href="/rounds/new"
          className="rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary-dark"
        >
          + Apuntar resultado
        </Link>
      </div>

      <div className="flex flex-col gap-2">
        {rounds.map((r) => (
          <Link
            key={r.id}
            href={`/rounds/${r.id}`}
            className="flex items-center justify-between rounded-lg border border-border bg-card p-3 hover:border-primary"
          >
            <div>
              <p className="font-medium">{r.course_name}</p>
              <p className="text-xs text-muted">
                {formatDateEs(r.played_on)} · {r.season_name} · {r.player_names.join(", ")}
              </p>
            </div>
            <span aria-hidden className="text-muted">
              →
            </span>
          </Link>
        ))}
        {rounds.length === 0 && (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted">
            Todavía no hay partidas registradas. ¡Apunta la primera!
          </p>
        )}
      </div>
    </div>
  );
}
