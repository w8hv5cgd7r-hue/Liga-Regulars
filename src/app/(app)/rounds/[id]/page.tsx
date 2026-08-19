import { notFound } from "next/navigation";
import Link from "next/link";
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
import { hasBackNine, splitFrontBack, summarizeMatchHoles, upDownLabel } from "@/lib/scoring/segments";
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
  const { front: frontHoles, back: backHoles } = splitFrontBack(holes);
  const showBackNine = hasBackNine(holes);

  const useHandicap = round.use_handicap !== false;
  const playerScores: PlayerHoleScores[] = round.players.map((rp) => ({
    player_id: rp.player_id,
    handicap: useHandicap ? rp.handicap : 0,
    strokes: Object.fromEntries(
      round.scores.filter((s) => s.player_id === rp.player_id).map((s) => [s.hole_number, s.strokes])
    ),
  }));

  const modality = round.season.modality;
  const canDelete = me.role === "admin" || me.id === round.created_by;

  const strokeTotal = modality === "stroke" ? computeStrokePlay(holes, playerScores) : [];
  const strokeFront = modality === "stroke" && frontHoles.length ? computeStrokePlay(frontHoles, playerScores) : [];
  const strokeBack = modality === "stroke" && backHoles.length ? computeStrokePlay(backHoles, playerScores) : [];

  const stablefordTotal = modality === "stableford" ? computeStableford(holes, playerScores) : [];
  const stablefordFront =
    modality === "stableford" && frontHoles.length ? computeStableford(frontHoles, playerScores) : [];
  const stablefordBack =
    modality === "stableford" && backHoles.length ? computeStableford(backHoles, playerScores) : [];

  const isMatch = modality === "match1v1" || modality === "matchpairs";
  const matchResult =
    isMatch && round.team_a && round.team_b
      ? computeMatchPlay(holes, playerScores, round.team_a, round.team_b)
      : null;
  const matchFrontSummary = matchResult
    ? summarizeMatchHoles(matchResult.holes.filter((h) => h.hole_number <= 9))
    : null;
  const matchBackSummary = matchResult
    ? summarizeMatchHoles(matchResult.holes.filter((h) => h.hole_number > 9))
    : null;
  const matchTotalSummary = matchResult ? summarizeMatchHoles(matchResult.holes) : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-primary-dark">{round.course.name}</h1>
          <p className="text-sm text-muted">
            {formatDateEs(round.played_on)} · {MODALITY_SHORT[modality]} · {round.season.name} ·{" "}
            <span className={useHandicap ? "" : "text-accent"}>
              {useHandicap ? "con hándicap" : "sin hándicap"}
            </span>
          </p>
          {round.notes && <p className="mt-1 text-sm">{round.notes}</p>}
        </div>
        {canDelete && (
          <div className="flex items-center gap-3">
            <Link
              href={`/rounds/${round.id}/editar`}
              className="text-sm font-medium text-primary underline"
            >
              Editar
            </Link>
            <DeleteRoundButton id={round.id} />
          </div>
        )}
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
            {(showBackNine ? frontHoles : holes).map((h) => (
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

          {showBackNine && (
            <>
              <DetailSubtotalRow
                label="Ida"
                modality={modality}
                players={round.players.map((rp) => rp.player_id)}
                strokeRows={strokeFront}
                stablefordRows={stablefordFront}
              />
              <tbody>
                {backHoles.map((h) => (
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
              <DetailSubtotalRow
                label="Vuelta"
                modality={modality}
                players={round.players.map((rp) => rp.player_id)}
                strokeRows={strokeBack}
                stablefordRows={stablefordBack}
              />
            </>
          )}
        </table>
      </section>

      {modality === "stroke" && (
        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-2 font-semibold">{MODALITY_SHORT.stroke} (neto)</h2>
          <ResultTable
            rows={strokeTotal.map((r) => ({
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
            rows={stablefordTotal.map((r) => ({
              name: nameById.get(r.player_id) ?? "?",
              main: r.points,
              extra: `bruto ${r.grossTotal}${r.thru ? "" : " · incompleta"}`,
            }))}
            unit="puntos"
          />
        </section>
      )}

      {isMatch && matchResult && round.team_a && round.team_b && (
        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-2 font-semibold">{MODALITY_SHORT[modality]}</h2>
          <p className="text-sm">
            {round.team_a.map((pid) => nameById.get(pid)).join(" y ")}{" "}
            <span className="text-muted">vs</span> {round.team_b.map((pid) => nameById.get(pid)).join(" y ")}
          </p>
          <p className="mt-1 text-lg font-bold text-primary-dark">
            {matchTotalSummary && matchTotalSummary.thru === 0
              ? "Sin empezar"
              : matchResult.outcome === "in_progress"
                ? `${upDownLabel(matchTotalSummary!)} · thru ${matchTotalSummary!.thru}`
                : matchResult.outcome === "halved"
                  ? "Empate (AS)"
                  : `Gana ${matchResult.outcome === "team_a" ? round.team_a.map((pid) => nameById.get(pid)).join(" y ") : round.team_b.map((pid) => nameById.get(pid)).join(" y ")} (${matchResult.statusLabel})`}
          </p>
          {showBackNine && matchFrontSummary && matchBackSummary && matchTotalSummary && (
            <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-muted">
              <div>
                <span className="block font-medium text-foreground">Ida</span>
                {matchFrontSummary.wonA}-{matchFrontSummary.wonB}
                {matchFrontSummary.halved ? ` (${matchFrontSummary.halved} emp.)` : ""}
              </div>
              <div>
                <span className="block font-medium text-foreground">Vuelta</span>
                {matchBackSummary.wonA}-{matchBackSummary.wonB}
                {matchBackSummary.halved ? ` (${matchBackSummary.halved} emp.)` : ""}
              </div>
              <div>
                <span className="block font-medium text-foreground">Total</span>
                {matchTotalSummary.wonA}-{matchTotalSummary.wonB}
                {matchTotalSummary.halved ? ` (${matchTotalSummary.halved} emp.)` : ""}
              </div>
            </div>
          )}
        </section>
      )}
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

function DetailSubtotalRow({
  label,
  modality,
  players,
  strokeRows,
  stablefordRows,
}: {
  label: string;
  modality: "stroke" | "stableford" | "match1v1" | "matchpairs";
  players: string[];
  strokeRows: ReturnType<typeof computeStrokePlay>;
  stablefordRows: ReturnType<typeof computeStableford>;
}) {
  if (modality !== "stroke" && modality !== "stableford") return null;
  return (
    <tbody>
      <tr className="border-t-2 border-border bg-background font-medium">
        <td className="px-1 py-1" colSpan={2}>
          {label}
        </td>
        {players.map((pid) => (
          <td key={pid} className="px-1 py-1 text-center">
            {modality === "stroke"
              ? (strokeRows.find((r) => r.player_id === pid)?.netTotal ?? "–")
              : (stablefordRows.find((r) => r.player_id === pid)?.points ?? "–")}
          </td>
        ))}
      </tr>
    </tbody>
  );
}
