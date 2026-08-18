// =========================================================================
// Motor de puntuación de golf: hándicap por hoyo, stroke play neto,
// stableford y match play (1 contra 1 y parejas a "mejor bola").
// Funciones puras, sin dependencias de Supabase, fáciles de testear.
// =========================================================================

export interface HoleInfo {
  hole_number: number;
  par: number;
  stroke_index: number; // dificultad del hoyo: 1 = más difícil
}

export interface PlayerHoleScores {
  player_id: string;
  handicap: number; // hándicap de juego del jugador para esa ronda
  strokes: Record<number, number>; // hole_number -> golpes brutos
}

/**
 * Golpes de hándicap que recibe un jugador en un hoyo concreto,
 * según el método estándar de asignación por índice de hoyo (stroke index).
 */
export function handicapStrokesForHole(handicap: number, strokeIndex: number): number {
  const hcp = Math.max(0, Math.round(handicap));
  const base = Math.floor(hcp / 18);
  const remainder = hcp % 18;
  return base + (strokeIndex <= remainder ? 1 : 0);
}

export function netStrokesForHole(
  grossStrokes: number,
  handicap: number,
  strokeIndex: number
): number {
  return grossStrokes - handicapStrokesForHole(handicap, strokeIndex);
}

/** Puntos Stableford de un hoyo a partir del resultado neto. */
export function stablefordPointsForHole(
  grossStrokes: number,
  par: number,
  handicap: number,
  strokeIndex: number
): number {
  const net = netStrokesForHole(grossStrokes, handicap, strokeIndex);
  const diff = net - par;
  return Math.max(0, 2 - diff);
}

export interface StrokePlayPlayerResult {
  player_id: string;
  grossTotal: number;
  netTotal: number;
  holesPlayed: number;
  thru: boolean; // true si completó todos los hoyos del campo
}

export function computeStrokePlay(
  holes: HoleInfo[],
  players: PlayerHoleScores[]
): StrokePlayPlayerResult[] {
  const results = players.map((p) => {
    let gross = 0;
    let net = 0;
    let played = 0;
    for (const h of holes) {
      const strokes = p.strokes[h.hole_number];
      if (strokes == null) continue;
      played += 1;
      gross += strokes;
      net += strokes - handicapStrokesForHole(p.handicap, h.stroke_index);
    }
    return {
      player_id: p.player_id,
      grossTotal: gross,
      netTotal: net,
      holesPlayed: played,
      thru: played === holes.length,
    };
  });
  return results.sort((a, b) => a.netTotal - b.netTotal);
}

export interface StablefordPlayerResult {
  player_id: string;
  points: number;
  grossTotal: number;
  holesPlayed: number;
  thru: boolean;
}

export function computeStableford(
  holes: HoleInfo[],
  players: PlayerHoleScores[]
): StablefordPlayerResult[] {
  const results = players.map((p) => {
    let points = 0;
    let gross = 0;
    let played = 0;
    for (const h of holes) {
      const strokes = p.strokes[h.hole_number];
      if (strokes == null) continue;
      played += 1;
      gross += strokes;
      points += stablefordPointsForHole(strokes, h.par, p.handicap, h.stroke_index);
    }
    return {
      player_id: p.player_id,
      points,
      grossTotal: gross,
      holesPlayed: played,
      thru: played === holes.length,
    };
  });
  return results.sort((a, b) => b.points - a.points);
}

export type MatchOutcome = "team_a" | "team_b" | "halved" | "in_progress";

export interface MatchHoleResult {
  hole_number: number;
  netA: number | null;
  netB: number | null;
  winner: "a" | "b" | "half" | null;
}

export interface MatchPlayResult {
  holes: MatchHoleResult[];
  holesWonA: number;
  holesWonB: number;
  holesHalved: number;
  outcome: MatchOutcome;
  /** Ej: "3&2" si se decidió antes del último hoyo, o "1 up" / "AS" si fue hasta el final. */
  statusLabel: string;
  decidedOnHole: number | null;
}

/**
 * Calcula el resultado de un match play (1vs1) o de un "mejor bola" de parejas.
 * team = array de player_id (1 elemento en 1vs1, 2 en parejas).
 */
export function computeMatchPlay(
  holes: HoleInfo[],
  players: PlayerHoleScores[],
  teamA: string[],
  teamB: string[]
): MatchPlayResult {
  const byId = new Map(players.map((p) => [p.player_id, p]));
  const holeResults: MatchHoleResult[] = [];
  let runningA = 0;
  let runningB = 0;
  let decidedOnHole: number | null = null;
  const totalHoles = holes.length;

  for (let i = 0; i < holes.length; i++) {
    const h = holes[i];

    // Neto del equipo en el hoyo = el mejor (menor) resultado neto entre sus
    // miembros ("mejor bola"); con un único jugador equivale al 1 contra 1.
    const teamNet = (team: string[]): number | null => {
      const nets: number[] = [];
      for (const id of team) {
        const p = byId.get(id);
        if (!p) continue;
        const strokes = p.strokes[h.hole_number];
        if (strokes == null) continue;
        nets.push(strokes - handicapStrokesForHole(p.handicap, h.stroke_index));
      }
      return nets.length ? Math.min(...nets) : null;
    };
    const netA = teamNet(teamA);
    const netB = teamNet(teamB);

    let winner: MatchHoleResult["winner"] = null;
    if (netA != null && netB != null && decidedOnHole == null) {
      if (netA < netB) {
        winner = "a";
        runningA += 1;
      } else if (netB < netA) {
        winner = "b";
        runningB += 1;
      } else {
        winner = "half";
      }

      const holesRemaining = totalHoles - (i + 1);
      const diff = Math.abs(runningA - runningB);
      if (diff > holesRemaining && decidedOnHole == null) {
        decidedOnHole = h.hole_number;
      }
    }

    holeResults.push({ hole_number: h.hole_number, netA, netB, winner });
  }

  const allPlayed = holeResults.every((h) => h.winner != null);
  let outcome: MatchOutcome = "in_progress";
  let statusLabel = "En juego";

  if (decidedOnHole != null) {
    const diff = Math.abs(runningA - runningB);
    outcome = runningA > runningB ? "team_a" : "team_b";
    const remainingAtDecision = totalHoles - decidedOnHole;
    statusLabel = `${diff}&${remainingAtDecision}`;
  } else if (allPlayed) {
    if (runningA === runningB) {
      outcome = "halved";
      statusLabel = "Empatado (AS)";
    } else {
      outcome = runningA > runningB ? "team_a" : "team_b";
      const diff = Math.abs(runningA - runningB);
      statusLabel = `${diff} up`;
    }
  }

  return {
    holes: holeResults,
    holesWonA: runningA,
    holesWonB: runningB,
    holesHalved: holeResults.filter((h) => h.winner === "half").length,
    outcome,
    statusLabel,
    decidedOnHole,
  };
}
