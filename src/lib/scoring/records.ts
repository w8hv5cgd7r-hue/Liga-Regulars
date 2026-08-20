// =========================================================================
// Récords históricos de la liga: mejores y peores tarjetas por modalidad
// individual (golpes/Stableford) y mayor diferencia de victoria en match
// play (1 contra 1 y parejas). Se calculan sobre TODAS las rondas completas
// de cada modalidad, de todas las temporadas juntas (los récords no se
// filtran por temporada) — reutiliza el mismo motor de puntuación y los
// mismos helpers que ya usa standings.ts, no introduce ninguna regla nueva.
// =========================================================================

import { computeMatchPlay, computeStableford, computeStrokePlay } from "./engine";
import { completePlayers, toHoleInfo } from "./standings";
import type { RoundFull } from "@/lib/types";

export interface RecordEntry {
  round_id: string;
  played_on: string;
  course_name: string;
  season_name: string;
  /** 1 jugador en golpes/Stableford/1vs1, 2 en parejas. */
  player_ids: string[];
  /** Valor numérico usado para ordenar (golpes netos, puntos, o diferencia de hoyos). */
  value: number;
  /** Texto ya formateado para mostrar ("72 (bruto 78)", "24 pts", "6&5"...). */
  valueLabel: string;
}

function baseEntry(
  round: RoundFull,
  playerIds: string[],
  value: number,
  valueLabel: string
): RecordEntry {
  return {
    round_id: round.id,
    played_on: round.played_on,
    course_name: round.course.name,
    season_name: round.season.name,
    player_ids: playerIds,
    value,
    valueLabel,
  };
}

function topN(entries: RecordEntry[], n: number, direction: "asc" | "desc"): RecordEntry[] {
  return entries
    .slice()
    .sort((a, b) => (direction === "asc" ? a.value - b.value : b.value - a.value))
    .slice(0, n);
}

/**
 * Mejores y peores tarjetas de golpes (neto), una entrada por jugador y
 * ronda; solo cuentan las rondas jugadas hasta el final (18 o 9 hoyos
 * completos, según el campo) para no mezclar tarjetas a medias.
 */
export function computeStrokeRecords(rounds: RoundFull[]): { best: RecordEntry[]; worst: RecordEntry[] } {
  const entries: RecordEntry[] = [];
  for (const round of rounds.filter((r) => r.season.modality === "stroke")) {
    const holes = toHoleInfo(round);
    if (!holes.length) continue;
    const players = completePlayers(round, holes);
    if (!players.length) continue;
    for (const r of computeStrokePlay(holes, players)) {
      entries.push(baseEntry(round, [r.player_id], r.netTotal, `${r.netTotal} (bruto ${r.grossTotal})`));
    }
  }
  return { best: topN(entries, 3, "asc"), worst: topN(entries, 3, "desc") };
}

/** Mejores y peores tarjetas Stableford, solo rondas completas. */
export function computeStablefordRecords(
  rounds: RoundFull[]
): { best: RecordEntry[]; worst: RecordEntry[] } {
  const entries: RecordEntry[] = [];
  for (const round of rounds.filter((r) => r.season.modality === "stableford")) {
    const holes = toHoleInfo(round);
    if (!holes.length) continue;
    const players = completePlayers(round, holes);
    if (!players.length) continue;
    for (const r of computeStableford(holes, players)) {
      entries.push(baseEntry(round, [r.player_id], r.points, `${r.points} pts (bruto ${r.grossTotal})`));
    }
  }
  return { best: topN(entries, 3, "desc"), worst: topN(entries, 3, "asc") };
}

/**
 * Mayor diferencia de victoria en match play (1 contra 1 o parejas): solo
 * cuentan los partidos decididos (con ganador claro, ni en juego ni
 * empatados) y en los que TODOS los jugadores de ambos lados completaron la
 * tarjeta, para que el resultado sea fiable.
 */
export function computeMatchMarginRecords(
  rounds: RoundFull[],
  modality: "match1v1" | "matchpairs"
): RecordEntry[] {
  const entries: RecordEntry[] = [];
  for (const round of rounds.filter((r) => r.season.modality === modality)) {
    const holes = toHoleInfo(round);
    if (!holes.length || !round.team_a?.length || !round.team_b?.length) continue;
    const players = completePlayers(round, holes);
    if (players.length < round.team_a.length + round.team_b.length) continue;

    const result = computeMatchPlay(holes, players, round.team_a, round.team_b);
    if (result.outcome !== "team_a" && result.outcome !== "team_b") continue;

    const margin = Math.abs(result.holesWonA - result.holesWonB);
    const winners = result.outcome === "team_a" ? round.team_a : round.team_b;
    entries.push(baseEntry(round, winners, margin, result.statusLabel));
  }
  return topN(entries, 3, "desc");
}

export interface LeagueRecords {
  strokeBest: RecordEntry[];
  strokeWorst: RecordEntry[];
  stablefordBest: RecordEntry[];
  stablefordWorst: RecordEntry[];
  match1v1Margin: RecordEntry[];
  matchpairsMargin: RecordEntry[];
}

export function computeLeagueRecords(rounds: RoundFull[]): LeagueRecords {
  const stroke = computeStrokeRecords(rounds);
  const stableford = computeStablefordRecords(rounds);
  return {
    strokeBest: stroke.best,
    strokeWorst: stroke.worst,
    stablefordBest: stableford.best,
    stablefordWorst: stableford.worst,
    match1v1Margin: computeMatchMarginRecords(rounds, "match1v1"),
    matchpairsMargin: computeMatchMarginRecords(rounds, "matchpairs"),
  };
}
