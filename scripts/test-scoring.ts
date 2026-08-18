// Comprobación rápida y manual del motor de puntuación.
// Ejecutar con: npx tsx scripts/test-scoring.ts
import {
  handicapStrokesForHole,
  computeStrokePlay,
  computeStableford,
  computeMatchPlay,
  type HoleInfo,
  type PlayerHoleScores,
} from "../src/lib/scoring/engine";

function assertEqual(actual: unknown, expected: unknown, label: string) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? "OK " : "FAIL"} ${label}` + (ok ? "" : ` -> esperado ${JSON.stringify(expected)}, obtenido ${JSON.stringify(actual)}`));
  if (!ok) process.exitCode = 1;
}

// --- handicapStrokesForHole -------------------------------------------------
assertEqual(handicapStrokesForHole(18, 5), 1, "hcp 18 recibe 1 golpe en cualquier hoyo");
assertEqual(handicapStrokesForHole(9, 9), 1, "hcp 9 recibe golpe en SI<=9");
assertEqual(handicapStrokesForHole(9, 10), 0, "hcp 9 no recibe golpe en SI 10");
assertEqual(handicapStrokesForHole(24, 6), 2, "hcp 24 recibe 2 golpes en los 6 hoyos mas dificiles");
assertEqual(handicapStrokesForHole(24, 7), 1, "hcp 24 recibe 1 golpe en el resto");
assertEqual(handicapStrokesForHole(0, 1), 0, "hcp 0 no recibe golpes");

// --- campo de 9 hoyos sencillo ---------------------------------------------
const holes: HoleInfo[] = Array.from({ length: 9 }, (_, i) => ({
  hole_number: i + 1,
  par: 4,
  stroke_index: i + 1, // hoyo 1 el mas dificil ... hoyo 9 el mas facil
}));

// Jugador A: hcp 9 -> recibe 1 golpe en TODOS los hoyos de este campo de 9 (SI 1..9)
const playerA: PlayerHoleScores = {
  player_id: "A",
  handicap: 9,
  strokes: Object.fromEntries(holes.map((h) => [h.hole_number, 4])), // par en todos
};
// Jugador B: hcp 0 (scratch), hace bogey en todos
const playerB: PlayerHoleScores = {
  player_id: "B",
  handicap: 0,
  strokes: Object.fromEntries(holes.map((h) => [h.hole_number, 5])),
};

const stroke = computeStrokePlay(holes, [playerA, playerB]);
// A: bruto 36, neto 36-9=27. B: bruto 45, neto 45.
assertEqual(stroke.find((r) => r.player_id === "A")?.netTotal, 27, "stroke play neto jugador A");
assertEqual(stroke.find((r) => r.player_id === "B")?.netTotal, 45, "stroke play neto jugador B");
assertEqual(stroke[0].player_id, "A", "A gana el stroke play neto");

const stable = computeStableford(holes, [playerA, playerB]);
// A: bruto par (4) pero recibe 1 golpe -> neto birdie en cada hoyo -> 3 puntos x 9 = 27
// B: bruto bogey (5), hcp 0 -> neto bogey en cada hoyo -> 1 punto x 9 = 9
assertEqual(stable.find((r) => r.player_id === "A")?.points, 27, "stableford jugador A (neto birdie, recibe golpe)");
assertEqual(stable.find((r) => r.player_id === "B")?.points, 9, "stableford jugador B (neto bogey todos los hoyos)");

// --- match play 1 vs 1: A gana claramente y debe cerrarse antes del hoyo 9 --
const playerC: PlayerHoleScores = {
  player_id: "C",
  handicap: 0,
  strokes: Object.fromEntries(holes.map((h) => [h.hole_number, 6])), // doble bogey siempre
};
const match = computeMatchPlay(holes, [playerA, playerC], ["A"], ["C"]);
// A neto 3 en cada hoyo (4-1), C neto 6. A gana todos los hoyos.
// Se decide en el hoyo 5 (5 arriba con 4 por jugar -> 5&4)
assertEqual(match.decidedOnHole, 5, "match decidido en el hoyo 5");
assertEqual(match.statusLabel, "5&4", "resultado 5&4");
assertEqual(match.outcome, "team_a", "gana el equipo A");

// --- parejas (mejor bola): A+C vs B solo (ejemplo simplificado con 2 vs 1) --
const bestBall = computeMatchPlay(holes, [playerA, playerB, playerC], ["A", "C"], ["B"]);
// mejor bola de A+C = min(neto A=3, neto C=6) = 3 cada hoyo. B neto = 5 cada hoyo.
// Equipo A+C gana todos -> decidido hoyo 5, 5&4
assertEqual(bestBall.statusLabel, "5&4", "mejor bola de parejas tambien decide en hoyo 5");

console.log("\nTerminado.");
