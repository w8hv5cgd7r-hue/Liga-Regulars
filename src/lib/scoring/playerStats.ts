import {
  computeMatchPlay,
  computeStableford,
  computeStrokePlay,
  type HoleInfo,
  type PlayerHoleScores,
} from "./engine";
import type { RoundFull } from "@/lib/types";

export interface PlayerRoundStat {
  round_id: string;
  played_on: string;
  course_name: string;
  season_name: string;
  handicap: number;
  gross: number;
  net: number;
  netToPar: number;
  stablefordPoints: number;
  position: number;
  participants: number;
}

export interface PlayerMatchStat {
  round_id: string;
  played_on: string;
  modality: "match1v1" | "matchpairs";
  outcome: "win" | "loss" | "halve";
  teammates: string[];
  opponents: string[];
  statusLabel: string;
}

function toHoleInfo(round: RoundFull): HoleInfo[] {
  return [...round.course.holes]
    .sort((a, b) => a.hole_number - b.hole_number)
    .map((h) => ({ hole_number: h.hole_number, par: h.par, stroke_index: h.stroke_index }));
}

function toPlayerScores(round: RoundFull): PlayerHoleScores[] {
  return round.players.map((rp) => ({
    player_id: rp.player_id,
    handicap: rp.handicap,
    strokes: Object.fromEntries(
      round.scores.filter((s) => s.player_id === rp.player_id).map((s) => [s.hole_number, s.strokes])
    ),
  }));
}

function playedAllHoles(round: RoundFull, playerId: string, holes: HoleInfo[]): boolean {
  return holes.every((h) =>
    round.scores.some((s) => s.player_id === playerId && s.hole_number === h.hole_number)
  );
}

/** Historial de un jugador en rondas de golpes (round.season.modality === 'stroke'). */
export function computePlayerStrokeStats(rounds: RoundFull[], playerId: string): PlayerRoundStat[] {
  const stats: PlayerRoundStat[] = [];

  for (const round of rounds.filter((r) => r.season.modality === "stroke")) {
    const holes = toHoleInfo(round);
    if (!holes.length || !playedAllHoles(round, playerId, holes)) continue;

    const players = toPlayerScores(round).filter((p) => holes.every((h) => p.strokes[h.hole_number] != null));
    if (players.length < 2 || !players.some((p) => p.player_id === playerId)) continue;

    const results = computeStrokePlay(holes, players);
    const coursePar = holes.reduce((s, h) => s + h.par, 0);
    const idx = results.findIndex((r) => r.player_id === playerId);
    const row = results[idx];
    const mine = round.players.find((rp) => rp.player_id === playerId)!;

    stats.push({
      round_id: round.id,
      played_on: round.played_on,
      course_name: round.course.name,
      season_name: round.season.name,
      handicap: mine.handicap,
      gross: row.grossTotal,
      net: row.netTotal,
      netToPar: row.netTotal - coursePar,
      stablefordPoints: 0,
      position: idx + 1,
      participants: players.length,
    });
  }

  return stats.sort((a, b) => a.played_on.localeCompare(b.played_on));
}

/** Historial de un jugador en rondas Stableford (round.season.modality === 'stableford'). */
export function computePlayerStablefordStats(rounds: RoundFull[], playerId: string): PlayerRoundStat[] {
  const stats: PlayerRoundStat[] = [];

  for (const round of rounds.filter((r) => r.season.modality === "stableford")) {
    const holes = toHoleInfo(round);
    if (!holes.length || !playedAllHoles(round, playerId, holes)) continue;

    const players = toPlayerScores(round).filter((p) => holes.every((h) => p.strokes[h.hole_number] != null));
    if (!players.some((p) => p.player_id === playerId)) continue;

    const results = computeStableford(holes, players);
    const strokeCheck = computeStrokePlay(holes, players);
    const idx = results.findIndex((r) => r.player_id === playerId);
    const row = results[idx];
    const grossRow = strokeCheck.find((r) => r.player_id === playerId)!;
    const coursePar = holes.reduce((s, h) => s + h.par, 0);
    const mine = round.players.find((rp) => rp.player_id === playerId)!;

    stats.push({
      round_id: round.id,
      played_on: round.played_on,
      course_name: round.course.name,
      season_name: round.season.name,
      handicap: mine.handicap,
      gross: grossRow.grossTotal,
      net: grossRow.netTotal,
      netToPar: grossRow.netTotal - coursePar,
      stablefordPoints: row.points,
      position: idx + 1,
      participants: players.length,
    });
  }

  return stats.sort((a, b) => a.played_on.localeCompare(b.played_on));
}

/** Historial de partidos de un jugador en la modalidad de match play indicada. */
export function computePlayerMatchStats(
  rounds: RoundFull[],
  playerId: string,
  modality: "match1v1" | "matchpairs"
): PlayerMatchStat[] {
  const stats: PlayerMatchStat[] = [];

  for (const round of rounds.filter((r) => r.season.modality === modality)) {
    const holes = toHoleInfo(round);
    if (!holes.length || !round.team_a?.length || !round.team_b?.length) continue;
    const inA = round.team_a.includes(playerId);
    const inB = round.team_b.includes(playerId);
    if (!inA && !inB) continue;

    const players = toPlayerScores(round);
    const result = computeMatchPlay(holes, players, round.team_a, round.team_b);
    if (result.outcome === "in_progress") continue;

    const myTeam = inA ? round.team_a : round.team_b;
    const otherTeam = inA ? round.team_b : round.team_a;
    const wonByA = result.outcome === "team_a";
    const outcome: PlayerMatchStat["outcome"] =
      result.outcome === "halved" ? "halve" : wonByA === inA ? "win" : "loss";

    stats.push({
      round_id: round.id,
      played_on: round.played_on,
      modality,
      outcome,
      teammates: myTeam.filter((id) => id !== playerId),
      opponents: otherTeam,
      statusLabel: result.statusLabel,
    });
  }

  return stats.sort((a, b) => a.played_on.localeCompare(b.played_on));
}

/** Número total de rondas (de cualquier modalidad) en las que ha participado el jugador. */
export function countRoundsPlayed(rounds: RoundFull[], playerId: string): number {
  return rounds.filter((r) => r.players.some((p) => p.player_id === playerId)).length;
}

export interface HandicapPoint {
  played_on: string;
  handicap: number;
}

/**
 * Evolución del hándicap del jugador a partir del hándicap que se guardó en
 * cada ronda en la que participó (de cualquier modalidad: golpes, stableford
 * o match play, ya que en todas se registra su hándicap de ese día).
 */
export function computePlayerHandicapHistory(rounds: RoundFull[], playerId: string): HandicapPoint[] {
  return rounds
    .map((r) => {
      const mine = r.players.find((rp) => rp.player_id === playerId);
      return mine ? { played_on: r.played_on, handicap: mine.handicap } : null;
    })
    .filter((p): p is HandicapPoint => p !== null)
    .sort((a, b) => a.played_on.localeCompare(b.played_on));
}
