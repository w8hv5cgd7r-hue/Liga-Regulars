import { notFound } from "next/navigation";
import { getRoundFull } from "@/lib/data/rounds";
import { getPlayers } from "@/lib/data/players";
import { requireActivePlayer } from "@/lib/auth";
import { formatDateEs } from "@/lib/format";
import {
  computeMatchPlay,
  computeStableford,
  computeStrokePlay,
  type HoleInfo,
  type PlayerHoleScores,
} from "@/lib/scoring/engine";
import { MODALITY_SHORT } from "@/lib/types";
import { DeleteRoundButton } from "@/components/rounds/DeleteRoundButton";

export default async function RoundDetailPage({ params }: PageProps<"/rounds/[id]">) {
  const { id } = await params;
  const me = await requireActivePlayer();
  const [round, allPlayers] = await Promise.all([getRoundFull(id), getPlayers()]);
  if (!round) notFound();

  const nameById = new Map(allPlayers.map((p) => [p.id, p.full_name]));
  const holes: HoleInfo[] = [...round.course.holes]
    .sort((a, b) => a.hole_number - b.hole_number)
    .map((h) => ({ hole_number: h.hole_number, par: h.par, stroke_index: h.stroke_index }));

  const playerScores: PlayerHoleScores[] = round.players.map((rp) => ({
    player_id: rp.player_id,
    handicap: rp.handicap,
    strokes: Object.fromEntries(
      round.scores.filter((s) => s.player_id === rp.player_id).map((s) => [s.hole_number, s.strokes])
    ),
  }));

  const modality = round.season.modality;
  const canDelete = me.role === "admin" || me.id === round.created_by;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-primary-dark">{round.course.name}</h1>
          <p className="text-sm text-muted">
            {formatDateEs(round.played_on)} · {MODALITY_SHORT[modality]} · {round.season.name}
          </p>
          {round.notes && <p className="mt-1 text-sm">{round.notes}</p>}
        </div>
        {canDelete && <DeleteRoundButton id={round.id} />}
      </div>

      <section className="overflow-x-auto rounded-lg border border-border bg-card p-3">
        <h2 className="mb-2 font-semibold">Tarjeta</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="px-1 py-1">Hoyo</th>
              <th className="px-1 py-1">Par</th>
              {round.players.map((rp) => (
                <th key={rp.player_id} className="px-1 py-1 text-center">
                  {nameById.get(rp.player_id)?.split(" ")[0] ?? "?"}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {holes.map((h) => (
              <tr key={h.hole_number} className="border-t border-border">
                <td className="px-1 py-1 font-medium">
                  {h.hole_number}
                  <span className="ml-1 text-[10px] text-muted">SI{h.stroke_index}</span>
                </td>
                <td className="px-1 py-1 text-muted">{h.par}</td>
                {round.players.map((rp) => (
                  <td key={rp.player_id} className="px-1 py-1 text-center tabular-nums">
                    {playerScores.find((p) => p.player_id === rp.player_id)?.strokes[h.hole_number] ??
                      "–"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {modality === "stroke" && (
        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-2 font-semibold">{MODALITY_SHORT.stroke} (neto)</h2>
          <ResultTable
            rows={computeStrokePlay(holes, playerScores).map((r) => ({
              name: nameById.get(r.player_id) ?? "?",
              main: r.netTotal,
              extra: `bruto ${r.grossTotal}${r.thru ? "" : " · incompleta"}`,
            }))}
            unit="golpes netos"
          />
        </section>
      )}

      {modality === "stableford" && (
        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-2 font-semibold">{MODALITY_SHORT.stableford}</h2>
          <ResultTable
            rows={computeStableford(holes, playerScores).map((r) => ({
              name: nameById.get(r.player_id) ?? "?",
              main: r.points,
              extra: `bruto ${r.grossTotal}${r.thru ? "" : " · incompleta"}`,
            }))}
            unit="puntos"
          />
        </section>
      )}

      {(modality === "match1v1" || modality === "matchpairs") &&
        round.team_a &&
        round.team_b &&
        (() => {
          const result = computeMatchPlay(holes, playerScores, round.team_a!, round.team_b!);
          const teamAName = round.team_a!.map((id) => nameById.get(id)).join(" y ");
          const teamBName = round.team_b!.map((id) => nameById.get(id)).join(" y ");
          return (
            <section className="rounded-lg border border-border bg-card p-4">
              <h2 className="mb-2 font-semibold">{MODALITY_SHORT[modality]}</h2>
              <p className="text-sm">
                {teamAName} <span className="text-muted">vs</span> {teamBName}
              </p>
              <p className="mt-1 text-lg font-bold text-primary-dark">
                {result.outcome === "in_progress"
                  ? "Sin terminar"
                  : result.outcome === "halved"
                    ? "Empate"
                    : `Gana ${result.outcome === "team_a" ? teamAName : teamBName} (${result.statusLabel})`}
              </p>
            </section>
          );
        })()}
    </div>
  );
}

function ResultTable({
  rows,
  unit,
}: {
  rows: { name: string; main: number; extra: string }[];
  unit: string;
}) {
  return (
    <ol className="flex flex-col gap-1">
      {rows.map((r, idx) => (
        <li key={r.name} className="flex items-center justify-between rounded-md bg-background px-3 py-2">
          <span className="flex items-center gap-2">
            <span className="text-xs font-bold text-muted">{idx + 1}º</span>
            {r.name}
          </span>
          <span className="text-sm">
            <span className="font-semibold">{r.main}</span>{" "}
            <span className="text-xs text-muted">
              {unit} · {r.extra}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}
