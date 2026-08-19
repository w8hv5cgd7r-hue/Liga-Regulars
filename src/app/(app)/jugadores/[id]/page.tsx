import { notFound } from "next/navigation";
import { getPlayer, getPlayers } from "@/lib/data/players";
import { getRoundsFull } from "@/lib/data/rounds";
import {
  computePlayerHandicapHistory,
  computePlayerMatchStats,
  computePlayerStablefordStats,
  computePlayerStrokeStats,
  countRoundsPlayed,
} from "@/lib/scoring/playerStats";
import { HandicapChart, StablefordChart } from "@/components/players/PlayerCharts";
import { formatDateEs } from "@/lib/format";

export default async function PlayerStatsPage({ params }: PageProps<"/jugadores/[id]">) {
  const { id } = await params;
  const [player, allPlayers, rounds] = await Promise.all([
    getPlayer(id),
    getPlayers(),
    getRoundsFull(),
  ]);
  if (!player) notFound();

  const nameById = new Map(allPlayers.map((p) => [p.id, p.full_name]));
  const handicapHistory = computePlayerHandicapHistory(rounds, id);
  const strokeStats = computePlayerStrokeStats(rounds, id);
  const stablefordStats = computePlayerStablefordStats(rounds, id);
  const match1v1 = computePlayerMatchStats(rounds, id, "match1v1");
  const matchPairs = computePlayerMatchStats(rounds, id, "matchpairs");
  const totalRounds = countRoundsPlayed(rounds, id);

  const strokeWins = strokeStats.filter((r) => r.position === 1).length;
  const stablefordWins = stablefordStats.filter((r) => r.position === 1).length;
  const avgNetToPar = strokeStats.length
    ? Math.round((strokeStats.reduce((s, r) => s + r.netToPar, 0) / strokeStats.length) * 10) / 10
    : null;
  const avgStableford = stablefordStats.length
    ? Math.round(
        (stablefordStats.reduce((s, r) => s + r.stablefordPoints, 0) / stablefordStats.length) * 10
      ) / 10
    : null;

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
          <p className="text-sm text-muted">Hándicap actual: {player.handicap}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Partidas jugadas" value={totalRounds} />
        <StatCard label="Victorias golpes" value={strokeWins} />
        <StatCard label="Victorias stableford" value={stablefordWins} />
        <StatCard
          label="Neto medio (vs par)"
          value={avgNetToPar == null ? "–" : avgNetToPar > 0 ? `+${avgNetToPar}` : avgNetToPar}
        />
      </div>

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-2 font-semibold">Evolución del hándicap</h2>
        <HandicapChart stats={handicapHistory} />
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-1 font-semibold">Puntos Stableford por partida</h2>
        <p className="mb-2 text-xs text-muted">Media: {avgStableford ?? "–"} puntos</p>
        <StablefordChart stats={stablefordStats} />
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <MatchSummaryCard title="1 contra 1" matches={match1v1} nameById={nameById} />
        <MatchSummaryCard title="Parejas" matches={matchPairs} nameById={nameById} />
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-2 font-semibold">Últimas partidas de golpes</h2>
        <div className="flex flex-col gap-1">
          {[...strokeStats]
            .reverse()
            .slice(0, 5)
            .map((r) => (
              <div key={r.round_id} className="flex items-center justify-between text-sm">
                <span>
                  {formatDateEs(r.played_on)} · {r.course_name} · {r.season_name}
                  {!r.use_handicap && <span className="ml-1 text-xs text-muted">(sin hcp)</span>}
                </span>
                <span className="text-muted">Neto {r.net}</span>
              </div>
            ))}
          {strokeStats.length === 0 && <p className="text-sm text-muted">Sin partidas de golpes.</p>}
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-2 font-semibold">Últimas partidas Stableford</h2>
        <div className="flex flex-col gap-1">
          {[...stablefordStats]
            .reverse()
            .slice(0, 5)
            .map((r) => (
              <div key={r.round_id} className="flex items-center justify-between text-sm">
                <span>
                  {formatDateEs(r.played_on)} · {r.course_name} · {r.season_name}
                  {!r.use_handicap && <span className="ml-1 text-xs text-muted">(sin hcp)</span>}
                </span>
                <span className="text-muted">{r.stablefordPoints} pts</span>
              </div>
            ))}
          {stablefordStats.length === 0 && (
            <p className="text-sm text-muted">Sin partidas Stableford.</p>
          )}
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 text-center">
      <p className="text-2xl font-bold text-primary-dark">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}

function MatchSummaryCard({
  title,
  matches,
  nameById,
}: {
  title: string;
  matches: ReturnType<typeof computePlayerMatchStats>;
  nameById: Map<string, string>;
}) {
  const wins = matches.filter((m) => m.outcome === "win").length;
  const halves = matches.filter((m) => m.outcome === "halve").length;
  const losses = matches.filter((m) => m.outcome === "loss").length;

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="mb-1 font-semibold">{title}</h3>
      <p className="mb-3 text-sm text-muted">
        {wins}G - {halves}E - {losses}P ({matches.length} partidos)
      </p>
      <div className="flex flex-col gap-1 text-xs">
        {[...matches]
          .reverse()
          .slice(0, 5)
          .map((m, i) => (
            <div key={i} className="flex items-center justify-between">
              <span>
                {formatDateEs(m.played_on)} vs {m.opponents.map((id) => nameById.get(id)).join(" y ")}
              </span>
              <span
                className={
                  m.outcome === "win"
                    ? "font-medium text-primary"
                    : m.outcome === "loss"
                      ? "font-medium text-danger"
                      : "text-muted"
                }
              >
                {m.outcome === "win" ? "Gana" : m.outcome === "loss" ? "Pierde" : "Empate"} (
                {m.statusLabel})
              </span>
            </div>
          ))}
        {matches.length === 0 && <p className="text-muted">Sin partidos todavía.</p>}
      </div>
    </div>
  );
}
