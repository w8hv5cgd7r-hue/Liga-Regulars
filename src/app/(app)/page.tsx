import Link from "next/link";
import { requireActivePlayer } from "@/lib/auth";
import { getPlayers } from "@/lib/data/players";
import { getRounds, getRoundsFull } from "@/lib/data/rounds";
import { getSeasons, pickCurrentSeason } from "@/lib/data/seasons";
import { computeStandingsForModality, withPlayerInfo } from "@/lib/scoring/standings";
import { MODALITY_SHORT, type Modality } from "@/lib/types";
import { formatDateEs } from "@/lib/format";

const MODALITIES: Modality[] = ["stroke", "stableford", "match1v1", "matchpairs"];

export default async function DashboardPage() {
  const me = await requireActivePlayer();
  const [players, recentRounds, allRounds] = await Promise.all([
    getPlayers(),
    getRounds({ limit: 5 }),
    getRoundsFull(),
  ]);

  const leaders = await Promise.all(
    MODALITIES.map(async (modality) => {
      const seasons = await getSeasons(modality);
      const current = pickCurrentSeason(seasons);
      const scoped = current
        ? allRounds.filter((r) => r.season_id === current.id)
        : allRounds.filter((r) => r.season.modality === modality);
      const standings = withPlayerInfo(computeStandingsForModality(scoped, modality), players);
      return { modality, seasonName: current?.name ?? "General", leader: standings[0] };
    })
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-primary-dark">Hola, {me.full_name.split(" ")[0]} 👋</h1>
        <p className="text-sm text-muted">Aquí tienes el resumen de la liga.</p>
      </div>

      <Link
        href="/rounds/new"
        className="rounded-lg bg-primary px-4 py-4 text-center text-lg font-semibold text-primary-foreground hover:bg-primary-dark"
      >
        ⛳ Apuntar resultado
      </Link>

      <section>
        <h2 className="mb-2 font-semibold">Líderes de temporada</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {leaders.map(({ modality, seasonName, leader }) => (
            <Link
              key={modality}
              href={`/clasificaciones?modality=${modality}`}
              className="rounded-lg border border-border bg-card p-3 hover:border-primary"
            >
              <p className="text-xs text-muted">
                {MODALITY_SHORT[modality]} · {seasonName}
              </p>
              {leader ? (
                <p className="mt-1 font-semibold">
                  🏆 {leader.player?.full_name ?? "?"}{" "}
                  <span className="text-sm font-normal text-muted">({leader.totalPoints} pts)</span>
                </p>
              ) : (
                <p className="mt-1 text-sm text-muted">Sin resultados todavía</p>
              )}
            </Link>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold">Últimas partidas</h2>
          <Link href="/rounds" className="text-sm font-medium text-primary underline">
            Ver todas
          </Link>
        </div>
        <div className="flex flex-col gap-2">
          {recentRounds.map((r) => (
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
            </Link>
          ))}
          {recentRounds.length === 0 && (
            <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted">
              Todavía no hay partidas. ¡Apunta la primera!
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
