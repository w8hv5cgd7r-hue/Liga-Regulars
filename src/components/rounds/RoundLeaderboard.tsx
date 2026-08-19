// =========================================================================
// Clasificación de una partida de golpes o Stableford: lista ordenada de
// jugadores con su resultado, "a par" (cuando aplica) y hasta qué hoyo
// llevan ("thru"). Se usa tanto en vivo (mientras se apuntan golpes en
// RoundForm) como en la partida ya terminada (detalle de la partida), con
// los mismos datos que ya calcula el motor de puntuación.
// =========================================================================

export interface LeaderboardRow {
  player_id: string;
  name: string;
  main: number;
  mainLabel: string;
  toPar?: string;
  thru: string;
  extra?: string;
}

export function RoundLeaderboard({ rows, emptyLabel }: { rows: LeaderboardRow[]; emptyLabel?: string }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted">{emptyLabel ?? "Todavía no hay resultados que mostrar."}</p>
    );
  }
  const showToPar = rows.some((r) => r.toPar != null);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-muted">
            <th className="px-1 py-1">Pos</th>
            <th className="px-1 py-1">Jugador</th>
            <th className="px-1 py-1 text-center">{rows[0].mainLabel}</th>
            {showToPar && <th className="px-1 py-1 text-center">A par</th>}
            <th className="px-1 py-1 text-center">Thru</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => (
            <tr key={r.player_id} className="border-t border-border">
              <td className="px-1 py-1.5 text-xs font-bold text-muted">{idx + 1}º</td>
              <td className="px-1 py-1.5 font-medium">{r.name}</td>
              <td className="px-1 py-1.5 text-center tabular-nums">
                <span className="font-semibold">{r.main}</span>
                {r.extra && <span className="ml-1 text-[11px] font-normal text-muted">{r.extra}</span>}
              </td>
              {showToPar && (
                <td className="px-1 py-1.5 text-center tabular-nums text-muted">{r.toPar ?? "–"}</td>
              )}
              <td className="px-1 py-1.5 text-center tabular-nums text-muted">{r.thru}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
