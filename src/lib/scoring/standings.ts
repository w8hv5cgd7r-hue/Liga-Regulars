// =========================================================================
// Agregación de clasificaciones a partir de un conjunto de rondas.
// Cada ronda pertenece a UNA sola temporada y por tanto a UNA sola modalidad
// (round.season.modality): estas funciones asumen que ya se les pasan solo
// las rondas de la modalidad que se quiere calcular.
// =========================================================================

import {
  computeMatchPlay,
  computeStableford,
  computeStrokePlay,
  type HoleInfo,
  type PlayerHoleScores,
} from "./engine";
import type { Modality, Player, RoundFull } from "@/lib/types";

/** Puntos de "orden de mérito" según la posición en una ronda de golpes. */
export const POSITION_POINTS = [10, 7, 5, 3, 2, 1];
function pointsForPosition(position1based: number): number {
  return POSITION_POINTS[position1based - 1] ?? 1;
}

/** Puntos de liga para match play: victoria / empate / derrota. */
export const MATCH_WIN_POINTS = 3;
export const MATCH_HALVE_POINTS = 1;
export const MATCH_LOSS_POINTS = 0;

export interface StandingRow {
  player_id: string;
  roundsPlayed: number;
  totalPoints: number;
  // extra, según modalidad
  wins?: number;
  halves?: number;
  losses?: number;
  bestNetToPar?: number;
  avgNet?: number;
  bestStablefordPoints?: number;
}

function toHoleInfo(round: RoundFull): HoleInfo[] {
  return round.course.holes
    .slice()
    .sort((a, b) => a.hole_number - b.hole_number)
    .map((h) => ({ hole_number: h.hole_number, par: h.par, stroke_index: h.stroke_index }));
}

function toPlayerScores(round: RoundFull): PlayerHoleScores[] {
  return round.players.map((rp) => ({
    player_id: rp.player_id,
    // Si la ronda se jugó sin hándicap, se computa como si todos fueran
    // scratch (0); el hándicap real se conserva en round.players para el
    // histórico, pero aquí no se aplica.
    handicap: round.use_handicap === false ? 0 : rp.handicap,
    strokes: Object.fromEntries(
      round.scores
        .filter((s) => s.player_id === rp.player_id)
        .map((s) => [s.hole_number, s.strokes])
    ),
  }));
}

function completePlayers(round: RoundFull, holes: HoleInfo[]): PlayerHoleScores[] {
  return toPlayerScores(round).filter((p) => holes.every((h) => p.strokes[h.hole_number] != null));
}

export function computeStrokeStandings(rounds: RoundFull[]): StandingRow[] {
  const table = new Map<string, StandingRow>();

  for (const round of rounds) {
    const holes = toHoleInfo(round);
    if (!holes.length) continue;
    const players = completePlayers(round, holes);
    // Para repartir puntos por posición hacen falta al menos 2 jugadores con
    // los que comparar; si solo hay 1, esa ronda no puntúa para golpes.
    if (players.length < 2) continue;

    const results = computeStrokePlay(holes, players);
    const coursePar = holes.reduce((sum, h) => sum + h.par, 0);

    results.forEach((r, idx) => {
      const row = table.get(r.player_id) ?? {
        player_id: r.player_id,
        roundsPlayed: 0,
        totalPoints: 0,
        bestNetToPar: undefined,
        avgNet: 0,
      };
      row.roundsPlayed += 1;
      row.totalPoints += pointsForPosition(idx + 1);
      const netToPar = r.netTotal - coursePar;
      row.bestNetToPar =
        row.bestNetToPar == null ? netToPar : Math.min(row.bestNetToPar, netToPar);
      row.avgNet = (row.avgNet ?? 0) + r.netTotal;
      table.set(r.player_id, row);
    });
  }

  const rows = [...table.values()].map((r) => ({
    ...r,
    avgNet: r.roundsPlayed ? Math.round(((r.avgNet ?? 0) / r.roundsPlayed) * 10) / 10 : 0,
  }));
  return rows.sort((a, b) => b.totalPoints - a.totalPoints);
}

export function computeStablefordStandings(rounds: RoundFull[]): StandingRow[] {
  const table = new Map<string, StandingRow>();

  for (const round of rounds) {
    const holes = toHoleInfo(round);
    if (!holes.length) continue;
    // El Stableford puntúa de forma absoluta (no relativa a los demás), así
    // que una tarjeta individual también cuenta.
    const players = completePlayers(round, holes);
    if (players.length === 0) continue;

    const results = computeStableford(holes, players);
    for (const r of results) {
      const row = table.get(r.player_id) ?? {
        player_id: r.player_id,
        roundsPlayed: 0,
        totalPoints: 0,
        bestStablefordPoints: undefined,
      };
      row.roundsPlayed += 1;
      row.totalPoints += r.points;
      row.bestStablefordPoints =
        row.bestStablefordPoints == null
          ? r.points
          : Math.max(row.bestStablefordPoints, r.points);
      table.set(r.player_id, row);
    }
  }

  return [...table.values()].sort((a, b) => b.totalPoints - a.totalPoints);
}

export function computeMatchStandings(rounds: RoundFull[]): StandingRow[] {
  const table = new Map<string, StandingRow>();

  const ensure = (id: string) =>
    table.get(id) ??
    ({ player_id: id, roundsPlayed: 0, totalPoints: 0, wins: 0, halves: 0, losses: 0 } as StandingRow);

  for (const round of rounds) {
    const holes = toHoleInfo(round);
    if (!holes.length || !round.team_a?.length || !round.team_b?.length) continue;
    const players = toPlayerScores(round);

    const result = computeMatchPlay(holes, players, round.team_a, round.team_b);
    if (result.outcome === "in_progress") continue;

    const applyTeam = (team: string[], outcomeForTeam: "win" | "loss" | "halve") => {
      for (const id of team) {
        const row = ensure(id);
        row.roundsPlayed += 1;
        if (outcomeForTeam === "win") {
          row.totalPoints += MATCH_WIN_POINTS;
          row.wins = (row.wins ?? 0) + 1;
        } else if (outcomeForTeam === "halve") {
          row.totalPoints += MATCH_HALVE_POINTS;
          row.halves = (row.halves ?? 0) + 1;
        } else {
          row.totalPoints += MATCH_LOSS_POINTS;
          row.losses = (row.losses ?? 0) + 1;
        }
        table.set(id, row);
      }
    };

    if (result.outcome === "halved") {
      applyTeam(round.team_a, "halve");
      applyTeam(round.team_b, "halve");
    } else if (result.outcome === "team_a") {
      applyTeam(round.team_a, "win");
      applyTeam(round.team_b, "loss");
    } else {
      applyTeam(round.team_a, "loss");
      applyTeam(round.team_b, "win");
    }
  }

  return [...table.values()].sort((a, b) => b.totalPoints - a.totalPoints);
}

/** Filtra a las rondas de la modalidad indicada (según su temporada) y calcula la clasificación. */
export function computeStandingsForModality(rounds: RoundFull[], modality: Modality): StandingRow[] {
  const scoped = rounds.filter((r) => r.season.modality === modality);
  switch (modality) {
    case "stroke":
      return computeStrokeStandings(scoped);
    case "stableford":
      return computeStablefordStandings(scoped);
    case "match1v1":
    case "matchpairs":
      return computeMatchStandings(scoped);
  }
}

export function withPlayerInfo(rows: StandingRow[], players: Player[]) {
  const byId = new Map(players.map((p) => [p.id, p]));
  return rows.map((r) => ({ ...r, player: byId.get(r.player_id) }));
}
