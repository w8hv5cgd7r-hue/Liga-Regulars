// =========================================================================
// Helpers de presentación para dividir una tarjeta en ida (hoyos 1-9) y
// vuelta (hoyos 10-18), y para resumir el estado de un match play (quién va
// arriba, por cuántos hoyos, y hasta qué hoyo) a partir del resultado
// hoyo a hoyo que ya calcula el motor de puntuación. No cambia las reglas
// de puntuación, solo agrega/filtra lo que ya devuelve engine.ts.
// =========================================================================

import type { HoleInfo, MatchHoleResult } from "./engine";

export interface HoleSegments<T extends { hole_number: number }> {
  front: T[];
  back: T[];
}

/** Divide un conjunto de hoyos (o resultados por hoyo) en ida (1-9) y vuelta (10-18). */
export function splitFrontBack<T extends { hole_number: number }>(holes: T[]): HoleSegments<T> {
  return {
    front: holes.filter((h) => h.hole_number <= 9),
    back: holes.filter((h) => h.hole_number > 9),
  };
}

/** true si el campo tiene más de 9 hoyos y por tanto tiene sentido mostrar ida/vuelta por separado. */
export function hasBackNine(holes: HoleInfo[]): boolean {
  return holes.some((h) => h.hole_number > 9);
}

export interface MatchSegmentSummary {
  wonA: number;
  wonB: number;
  halved: number;
  /** Nº de hoyos de este tramo que ya tienen resultado. */
  thru: number;
  total: number;
}

/** Resume un tramo de hoyos de un match play: hoyos ganados por cada lado, empatados y jugados. */
export function summarizeMatchHoles(holeResults: MatchHoleResult[]): MatchSegmentSummary {
  return {
    wonA: holeResults.filter((h) => h.winner === "a").length,
    wonB: holeResults.filter((h) => h.winner === "b").length,
    halved: holeResults.filter((h) => h.winner === "half").length,
    thru: holeResults.filter((h) => h.winner != null).length,
    total: holeResults.length,
  };
}

/** Texto corto tipo "2 arriba" / "Empatados" / "3 abajo" a partir de un resumen de tramo. */
export function upDownLabel(summary: MatchSegmentSummary, sideALabel = "A", sideBLabel = "B"): string {
  const diff = summary.wonA - summary.wonB;
  if (diff === 0) return "Empatados";
  return diff > 0 ? `${diff} arriba (${sideALabel})` : `${Math.abs(diff)} arriba (${sideBLabel})`;
}
