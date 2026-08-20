import { notFound } from "next/navigation";
import Link from "next/link";
import { Check } from "lucide-react";
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
import {
  hasBackNine,
  parPlayed,
  runningMatchStatuses,
  sideTextClass,
  splitFrontBack,
  summarizeMatchHoles,
  toParLabel,
  upDownLabel,
} from "@/lib/scoring/segments";
import { MODALITY_SHORT } from "@/lib/types";
import { DeleteRoundButton } from "@/components/rounds/DeleteRoundButton";
import { LiveRoundWatcher } from "@/components/rounds/LiveRoundWatcher";
import { RoundLeaderboard, type LeaderboardRow } from "@/components/rounds/RoundLeaderboard";

export default async function RoundDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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

  // true si todos los jugadores de la partida ya tienen golpe apuntado en
  // ese hoyo (para marcarlo visualmente como "ya jugado").
  function holeComplete(holeNumber: number): boolean {
    return (
      playerScores.length > 0 &&
      playerScores.every((p) => p.strokes[holeNumber] != null)
    );
  }

  // Se calcula siempre (no solo en modalidad golpes) porque también se
  // muestra como resultado de golpes dentro del resumen de match play.
  const strokeTotal = computeStrokePlay(holes, playerScores);
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
  const matchRunning = matchResult ? runningMatchStatuses(matchResult.holes) : [];
  const teamAName = round.team_a?.map((pid) => nameById.get(pid)).join(" y ") ?? "";
  const teamBName = round.team_b?.map((pid) => nameById.get(pid)).join(" y ") ?? "";
  const teamAIds = round.team_a ?? [];
  const teamBIds = round.team_b ?? [];
  const matchLeaderColorClass =
    matchTotalSummary && matchTotalSummary.wonA !== matchTotalSummary.wonB
      ? matchTotalSummary.wonA > matchTotalSummary.wonB
        ? "text-primary"
        : "text-accent"
      : "";

  return (
    <div className="flex flex-col gap-6">
      <LiveRoundWatcher roundId={round.id} />
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
                <th
                  key={rp.player_id}
                  className={`px-1 py-1 text-center font-medium ${
                    isMatch ? sideTextClass(rp.player_id, teamAIds, teamBIds) : ""
                  }`}
                >
                  {nameById.get(rp.player_id)?.split(" ")[0] ?? "?"}
                </th>
              ))}
              {isMatch && <th className="px-1 py-1 text-center">Resultado</th>}
            </tr>
          </thead>

          <tbody>
            {(showBackNine ? frontHoles : holes).map((h) => (
              <tr
                key={h.hole_number}
                className={`border-t border-border ${holeComplete(h.hole_number) ? "bg-primary/5" : ""}`}
              >
                <td className="px-1 py-1 font-medium">
                  <span className="inline-flex items-center gap-1">
                    {h.hole_number}
                    {holeComplete(h.hole_number) && (
                      <Check size={12} className="text-primary" aria-label="Hoyo ya jugado" />
                    )}
                  </span>
                  <span className="ml-1 text-[11px] text-muted">SI{h.stroke_index}</span>
                </td>
                <td className="px-1 py-1 text-muted">{h.par}</td>
                {round.players.map((rp) => (
                  <td key={rp.player_id} className="px-1 py-1 text-center tabular-nums">
                    {playerScores.find((p) => p.player_id === rp.player_id)?.strokes[h.hole_number] ??
                      "–"}
                  </td>
                ))}
                {isMatch && <MatchStatusCell running={matchRunning} holeNumber={h.hole_number} />}
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
                  <tr
                    key={h.hole_number}
                    className={`border-t border-border ${holeComplete(h.hole_number) ? "bg-primary/5" : ""}`}
                  >
                    <td className="px-1 py-1 font-medium">
                      <span className="inline-flex items-center gap-1">
                        {h.hole_number}
                        {holeComplete(h.hole_number) && (
                          <Check size={12} className="text-primary" aria-label="Hoyo ya jugado" />
                        )}
                      </span>
                      <span className="ml-1 text-[11px] text-muted">SI{h.stroke_index}</span>
                    </td>
                    <td className="px-1 py-1 text-muted">{h.par}</td>
                    {round.players.map((rp) => (
                      <td key={rp.player_id} className="px-1 py-1 text-center tabular-nums">
                        {playerScores.find((p) => p.player_id === rp.player_id)?.strokes[h.hole_number] ??
                          "–"}
                      </td>
                    ))}
                    {isMatch && <MatchStatusCell running={matchRunning} holeNumber={h.hole_number} />}
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
        {isMatch && (
          <p className="mt-2 text-xs text-muted">
            Columna «Resultado»: <span className="font-semibold text-primary">verde</span> ={" "}
            {teamAName || "equipo A"} arriba · <span className="font-semibold text-accent">ámbar</span> ={" "}
            {teamBName || "equipo B"} arriba · AS = empatados.
          </p>
        )}
      </section>

      {modality === "stroke" && (
        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-2 font-semibold">Clasificación · {MODALITY_SHORT.stroke} (neto)</h2>
          <RoundLeaderboard
            rows={strokeTotal.map((r): LeaderboardRow => {
              const strokes =
                playerScores.find((p) => p.player_id === r.player_id)?.strokes ?? {};
              return {
                player_id: r.player_id,
                name: nameById.get(r.player_id) ?? "?",
                main: r.netTotal,
                mainLabel: "Neto",
                toPar: toParLabel(r.netTotal, parPlayed(holes, strokes)),
                thru: `${r.holesPlayed}/${holes.length}`,
                extra: `bruto ${r.grossTotal}${r.thru ? "" : " · incompleta"}`,
              };
            })}
          />
        </section>
      )}

      {modality === "stableford" && (
        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-2 font-semibold">Clasificación · {MODALITY_SHORT.stableford}</h2>
          <RoundLeaderboard
            rows={stablefordTotal.map((r): LeaderboardRow => ({
              player_id: r.player_id,
              name: nameById.get(r.player_id) ?? "?",
              main: r.points,
              mainLabel: "Puntos",
              thru: `${r.holesPlayed}/${holes.length}`,
              extra: `bruto ${r.grossTotal}${r.thru ? "" : " · incompleta"}`,
            }))}
          />
        </section>
      )}

      {isMatch && matchResult && round.team_a && round.team_b && (
        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-2 font-semibold">{MODALITY_SHORT[modality]}</h2>
          <p className="text-sm">
            <span className="font-medium text-primary">{teamAName}</span>{" "}
            <span className="text-muted">vs</span>{" "}
            <span className="font-medium text-accent">{teamBName}</span>
          </p>
          <p className="mt-1 text-lg font-bold">
            {matchTotalSummary && matchTotalSummary.thru === 0 ? (
              <span className="text-primary-dark">Sin empezar</span>
            ) : matchResult.outcome === "in_progress" ? (
              <>
                <span className={matchLeaderColorClass}>
                  {upDownLabel(matchTotalSummary!, teamAName, teamBName)}
                </span>{" "}
                <span className="text-primary-dark">· thru {matchTotalSummary!.thru}</span>
              </>
            ) : matchResult.outcome === "halved" ? (
              <span className="text-primary-dark">Empate (AS)</span>
            ) : (
              <span className="text-primary-dark">
                Gana{" "}
                <span className={matchResult.outcome === "team_a" ? "text-primary" : "text-accent"}>
                  {matchResult.outcome === "team_a" ? teamAName : teamBName}
                </span>{" "}
                ({matchResult.statusLabel})
              </span>
            )}
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
          <div className="mt-3 border-t border-border pt-2">
            <span className="block text-xs font-medium text-foreground">
              Resultado de golpes {useHandicap ? "(neto)" : "(sin hándicap)"}
            </span>
            <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted">
              {round.players.map((rp) => {
                const row = strokeTotal.find((r) => r.player_id === rp.player_id);
                return (
                  <div key={rp.player_id} className="flex items-center justify-between">
                    <span className={`font-medium ${sideTextClass(rp.player_id, teamAIds, teamBIds)}`}>
                      {nameById.get(rp.player_id)?.split(" ")[0] ?? "?"}
                    </span>
                    <span>
                      {useHandicap
                        ? `${row?.netTotal ?? "–"} (bruto ${row?.grossTotal ?? "–"})`
                        : (row?.grossTotal ?? "–")}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}
    </div>
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

function MatchStatusCell({
  running,
  holeNumber,
}: {
  running: ReturnType<typeof runningMatchStatuses>;
  holeNumber: number;
}) {
  const status = running.find((r) => r.hole_number === holeNumber);
  return (
    <td
      className={`px-1 py-1 text-center text-xs font-semibold tabular-nums ${
        status?.leader === "a" ? "text-primary" : status?.leader === "b" ? "text-accent" : "text-muted"
      }`}
    >
      {status?.label || "–"}
    </td>
  );
}
