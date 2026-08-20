import type { RecordEntry } from "@/lib/scoring/records";
import type { Player } from "@/lib/types";
import { formatDateShortEs } from "@/lib/format";

function RecordTable({
  title,
  hint,
  entries,
  players,
}: {
  title: string;
  hint: string;
  entries: RecordEntry[];
  players: Player[];
}) {
  const nameById = new Map(players.map((p) => [p.id, p.full_name]));
  const playerNames = (ids: string[]) =>
    ids.map((id) => nameById.get(id)?.split(" ")[0] ?? "?").join(" y ");

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <h3 className="font-semibold">{title}</h3>
      <p className="text-xs text-muted">{hint}</p>
      {entries.length === 0 ? (
        <p className="mt-2 text-sm text-muted">Todavía no hay ninguna tarjeta que cuente para este récord.</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-1.5">
          {entries.map((e, idx) => (
            <li
              key={`${e.round_id}-${e.player_ids.join(",")}`}
              className="flex items-center justify-between gap-2 rounded-md bg-background px-2 py-1.5 text-sm"
            >
              <span className="flex items-center gap-2">
                <span className="w-5 shrink-0 text-xs font-bold text-muted">{idx + 1}º</span>
                <span>
                  <span className="font-medium">{playerNames(e.player_ids)}</span>
                  <span className="ml-1 text-xs text-muted">
                    {e.course_name} · {formatDateShortEs(e.played_on)}
                  </span>
                </span>
              </span>
              <span className="whitespace-nowrap font-semibold tabular-nums">{e.valueLabel}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function RecordsBoard({
  records,
  players,
}: {
  records: {
    strokeBest: RecordEntry[];
    strokeWorst: RecordEntry[];
    stablefordBest: RecordEntry[];
    stablefordWorst: RecordEntry[];
    match1v1Margin: RecordEntry[];
    matchpairsMargin: RecordEntry[];
  };
  players: Player[];
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted">
        Los récords cuentan todas las temporadas juntas (no se filtran por temporada) y solo las
        tarjetas jugadas hasta el final.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <RecordTable
          title="Mejor tarjeta · Golpes (neto)"
          hint="Menos golpes netos en una ronda completa."
          entries={records.strokeBest}
          players={players}
        />
        <RecordTable
          title="Peor tarjeta · Golpes (neto)"
          hint="Más golpes netos en una ronda completa."
          entries={records.strokeWorst}
          players={players}
        />
        <RecordTable
          title="Mejor tarjeta · Stableford"
          hint="Más puntos Stableford en una ronda completa."
          entries={records.stablefordBest}
          players={players}
        />
        <RecordTable
          title="Peor tarjeta · Stableford"
          hint="Menos puntos Stableford en una ronda completa."
          entries={records.stablefordWorst}
          players={players}
        />
        <RecordTable
          title="Mayor paliza · Match Play 1 vs 1"
          hint="Victoria con más diferencia de hoyos."
          entries={records.match1v1Margin}
          players={players}
        />
        <RecordTable
          title="Mayor paliza · Match Play Parejas"
          hint="Victoria con más diferencia de hoyos."
          entries={records.matchpairsMargin}
          players={players}
        />
      </div>
    </div>
  );
}
