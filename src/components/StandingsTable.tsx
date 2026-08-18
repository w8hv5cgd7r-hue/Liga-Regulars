import type { StandingRow } from "@/lib/scoring/standings";
import type { Modality, Player } from "@/lib/types";

export function StandingsTable({
  rows,
  modality,
}: {
  rows: (StandingRow & { player?: Player })[];
  modality: Modality;
}) {
  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted">
        Todavía no hay resultados para esta clasificación.
      </p>
    );
  }

  const isMatch = modality === "match1v1" || modality === "matchpairs";

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-background text-left text-xs text-muted">
          <tr>
            <th className="px-3 py-2">#</th>
            <th className="px-3 py-2">Jugador</th>
            <th className="px-3 py-2 text-right">Puntos</th>
            {isMatch ? (
              <>
                <th className="px-3 py-2 text-right">G</th>
                <th className="px-3 py-2 text-right">E</th>
                <th className="px-3 py-2 text-right">P</th>
              </>
            ) : modality === "stroke" ? (
              <th className="px-3 py-2 text-right">Mejor neto (vs par)</th>
            ) : (
              <th className="px-3 py-2 text-right">Mejor ronda</th>
            )}
            <th className="px-3 py-2 text-right">Jugadas</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => (
            <tr key={r.player_id} className="border-t border-border">
              <td className="px-3 py-2 font-bold text-muted">{idx + 1}</td>
              <td className="px-3 py-2 font-medium">{r.player?.full_name ?? "Jugador"}</td>
              <td className="px-3 py-2 text-right font-semibold">{r.totalPoints}</td>
              {isMatch ? (
                <>
                  <td className="px-3 py-2 text-right">{r.wins ?? 0}</td>
                  <td className="px-3 py-2 text-right">{r.halves ?? 0}</td>
                  <td className="px-3 py-2 text-right">{r.losses ?? 0}</td>
                </>
              ) : modality === "stroke" ? (
                <td className="px-3 py-2 text-right">
                  {r.bestNetToPar != null ? (r.bestNetToPar > 0 ? `+${r.bestNetToPar}` : r.bestNetToPar) : "–"}
                </td>
              ) : (
                <td className="px-3 py-2 text-right">{r.bestStablefordPoints ?? "–"}</td>
              )}
              <td className="px-3 py-2 text-right text-muted">{r.roundsPlayed}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
