"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus } from "lucide-react";
import { createRoundAction } from "@/lib/actions/round-actions";
import {
  computeMatchPlay,
  computeStableford,
  computeStrokePlay,
  type HoleInfo,
  type PlayerHoleScores,
} from "@/lib/scoring/engine";
import { MODALITY_LABEL, MODALITY_SHORT, type CourseWithHoles, type Modality, type Player, type Season } from "@/lib/types";
import { formatDateEs } from "@/lib/format";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

const MODALITY_ORDER: Modality[] = ["stroke", "stableford", "match1v1", "matchpairs"];

export function RoundForm({
  players,
  courses,
  seasons,
}: {
  players: Player[];
  courses: CourseWithHoles[];
  seasons: Season[];
}) {
  const router = useRouter();
  const [seasonId, setSeasonId] = useState(seasons[0]?.id ?? "");
  const [courseId, setCourseId] = useState(courses[0]?.id ?? "");
  const [playedOn, setPlayedOn] = useState(todayISO());
  const [notes, setNotes] = useState("");

  // golpes / stableford
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  // match1v1 / matchpairs
  const [teamA, setTeamA] = useState<string[]>([]);
  const [teamB, setTeamB] = useState<string[]>([]);

  const [handicaps, setHandicaps] = useState<Record<string, number>>({});
  const [scores, setScores] = useState<Record<string, Record<number, number>>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const season = seasons.find((s) => s.id === seasonId);
  const modality = season?.modality;
  const isMatch = modality === "match1v1" || modality === "matchpairs";
  const teamSize = modality === "match1v1" ? 1 : 2;

  const course = courses.find((c) => c.id === courseId);
  const holes = useMemo(
    () => (course ? [...course.holes].sort((a, b) => a.hole_number - b.hole_number) : []),
    [course]
  );

  const selectedIdsResolved = isMatch ? [...teamA, ...teamB] : selectedIds;
  const selectedPlayers = players.filter((p) => selectedIdsResolved.includes(p.id));

  function ensureHandicap(id: string, player: Player) {
    setHandicaps((prev) => (prev[id] != null ? prev : { ...prev, [id]: player.handicap }));
  }

  function togglePlayer(id: string, player: Player) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    ensureHandicap(id, player);
  }

  function toggleTeam(team: "A" | "B", id: string, player: Player) {
    const set = team === "A" ? teamA : teamB;
    const other = team === "A" ? teamB : teamA;
    const setter = team === "A" ? setTeamA : setTeamB;
    if (set.includes(id)) {
      setter(set.filter((x) => x !== id));
      return;
    }
    if (other.includes(id) || set.length >= teamSize) return;
    setter([...set, id]);
    ensureHandicap(id, player);
  }

  function setScore(playerId: string, holeNumber: number, value: number) {
    setScores((prev) => ({
      ...prev,
      [playerId]: { ...prev[playerId], [holeNumber]: Math.max(1, Math.min(15, value)) },
    }));
  }

  function fillPar(playerId: string) {
    const next: Record<number, number> = { ...scores[playerId] };
    for (const h of holes) if (next[h.hole_number] == null) next[h.hole_number] = h.par;
    setScores((prev) => ({ ...prev, [playerId]: next }));
  }

  // Vista previa en vivo del resultado con lo que se lleva introducido
  const holeInfos: HoleInfo[] = holes.map((h) => ({
    hole_number: h.hole_number,
    par: h.par,
    stroke_index: h.stroke_index,
  }));
  const playerScoresForEngine: PlayerHoleScores[] = selectedPlayers.map((p) => ({
    player_id: p.id,
    handicap: handicaps[p.id] ?? p.handicap,
    strokes: scores[p.id] ?? {},
  }));
  const strokePreview =
    modality === "stroke" && holeInfos.length ? computeStrokePlay(holeInfos, playerScoresForEngine) : [];
  const stablefordPreview =
    modality === "stableford" && holeInfos.length
      ? computeStableford(holeInfos, playerScoresForEngine)
      : [];
  const matchPreview =
    isMatch && holeInfos.length && teamA.length === teamSize && teamB.length === teamSize
      ? computeMatchPlay(holeInfos, playerScoresForEngine, teamA, teamB)
      : null;

  async function handleSubmit() {
    setError(null);
    if (!season) return setError("Elige una temporada.");
    if (!courseId || !playedOn) return setError("Elige campo y fecha.");

    if (isMatch) {
      if (teamA.length !== teamSize || teamB.length !== teamSize) {
        return setError(
          modality === "match1v1"
            ? "Elige un jugador para cada lado."
            : `Elige ${teamSize} jugadores para cada pareja.`
        );
      }
    } else if (selectedIds.length === 0) {
      return setError("Selecciona al menos un jugador.");
    }

    const scoreRows = selectedPlayers.flatMap((p) =>
      Object.entries(scores[p.id] ?? {}).map(([hole, strokes]) => ({
        player_id: p.id,
        hole_number: Number(hole),
        strokes,
      }))
    );
    if (scoreRows.length === 0) return setError("Introduce al menos algún resultado.");

    startTransition(async () => {
      const result = await createRoundAction({
        course_id: courseId,
        season_id: seasonId,
        played_on: playedOn,
        notes,
        players: selectedPlayers.map((p) => ({
          player_id: p.id,
          handicap: handicaps[p.id] ?? p.handicap,
        })),
        scores: scoreRows,
        team_a: isMatch ? teamA : undefined,
        team_b: isMatch ? teamB : undefined,
      });
      if (!result.ok) {
        setError(result.error ?? "No se pudo guardar la partida.");
        return;
      }
      router.push(`/rounds/${result.roundId}`);
    });
  }

  if (seasons.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted">
        Todavía no hay ninguna temporada creada. Un administrador tiene que crear al menos una
        (con su modalidad) antes de poder apuntar resultados.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-5 pb-6">
      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-3 font-semibold">¿Para qué cuenta esta partida?</h2>
        <label className="mb-1 block text-xs text-muted">Temporada y modalidad</label>
        <select
          value={seasonId}
          onChange={(e) => {
            setSeasonId(e.target.value);
            setSelectedIds([]);
            setTeamA([]);
            setTeamB([]);
            setScores({});
          }}
          className="w-full rounded-md border border-border px-3 py-2 text-sm"
        >
          {MODALITY_ORDER.map((m) => {
            const inModality = seasons.filter((s) => s.modality === m);
            if (inModality.length === 0) return null;
            return (
              <optgroup key={m} label={MODALITY_LABEL[m]}>
                {inModality.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({formatDateEs(s.start_date)} – {formatDateEs(s.end_date)})
                  </option>
                ))}
              </optgroup>
            );
          })}
        </select>
        {modality && (
          <p className="mt-2 text-xs text-muted">
            Esta tarjeta contará únicamente para la clasificación de{" "}
            <strong>{MODALITY_SHORT[modality]}</strong> en la temporada «{season?.name}».
          </p>
        )}
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-3 font-semibold">Campo y fecha</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs text-muted">Campo</label>
            <select
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              className="w-full rounded-md border border-border px-3 py-2 text-sm"
            >
              {courses.length === 0 && <option value="">No hay campos creados</option>}
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.holes.length} hoyos, par {c.par})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Fecha</label>
            <input
              type="date"
              value={playedOn}
              onChange={(e) => setPlayedOn(e.target.value)}
              className="w-full rounded-md border border-border px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div className="mt-3">
          <label className="mb-1 block text-xs text-muted">Notas (opcional)</label>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Viento fuerte, quedada especial…"
            className="w-full rounded-md border border-border px-3 py-2 text-sm"
          />
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-3 font-semibold">
          {isMatch ? "¿Quién juega contra quién?" : "¿Quién ha jugado?"}
        </h2>

        {!isMatch && (
          <div className="flex flex-col gap-2">
            {players.map((p) => {
              const checked = selectedIds.includes(p.id);
              return (
                <div key={p.id} className="flex items-center gap-3">
                  <label className="flex flex-1 items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => togglePlayer(p.id, p)}
                      className="h-5 w-5 min-h-0 accent-primary"
                    />
                    {p.full_name}
                  </label>
                  {checked && (
                    <HandicapInput
                      value={handicaps[p.id] ?? p.handicap}
                      onChange={(v) => setHandicaps((prev) => ({ ...prev, [p.id]: v }))}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {isMatch && (
          <div className="grid grid-cols-2 gap-4">
            <TeamPicker
              label={modality === "match1v1" ? "Jugador A" : "Pareja A"}
              players={players}
              selected={teamA}
              other={teamB}
              handicaps={handicaps}
              onToggle={(id, p) => toggleTeam("A", id, p)}
              onHandicapChange={(id, v) => setHandicaps((prev) => ({ ...prev, [id]: v }))}
            />
            <TeamPicker
              label={modality === "match1v1" ? "Jugador B" : "Pareja B"}
              players={players}
              selected={teamB}
              other={teamA}
              handicaps={handicaps}
              onToggle={(id, p) => toggleTeam("B", id, p)}
              onHandicapChange={(id, v) => setHandicaps((prev) => ({ ...prev, [id]: v }))}
            />
          </div>
        )}
      </section>

      {holes.length > 0 && selectedPlayers.length > 0 && (
        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-3 font-semibold">Tarjeta</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th className="w-16 px-1 py-1">Hoyo</th>
                  <th className="w-10 px-1 py-1">Par</th>
                  {selectedPlayers.map((p) => (
                    <th key={p.id} className="px-1 py-1 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className="whitespace-nowrap">{p.full_name.split(" ")[0]}</span>
                        <button
                          type="button"
                          onClick={() => fillPar(p.id)}
                          className="text-[10px] font-medium text-primary underline"
                        >
                          rellenar par
                        </button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {holes.map((h) => (
                  <tr key={h.hole_number} className="border-t border-border">
                    <td className="px-1 py-1 font-medium">
                      {h.hole_number}
                      <span className="ml-1 text-[10px] text-muted">SI{h.stroke_index}</span>
                    </td>
                    <td className="px-1 py-1 text-muted">{h.par}</td>
                    {selectedPlayers.map((p) => (
                      <td key={p.id} className="px-1 py-1">
                        <StrokeStepper
                          value={scores[p.id]?.[h.hole_number]}
                          onChange={(v) => setScore(p.id, h.hole_number, v)}
                          defaultValue={h.par}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              {modality === "stroke" && (
                <tfoot>
                  <tr className="border-t-2 border-border font-semibold">
                    <td className="px-1 py-2" colSpan={2}>
                      Bruto
                    </td>
                    {selectedPlayers.map((p) => (
                      <td key={p.id} className="px-1 py-2 text-center">
                        {strokePreview.find((r) => r.player_id === p.id)?.grossTotal ?? "–"}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="px-1 py-1 text-muted" colSpan={2}>
                      Neto
                    </td>
                    {selectedPlayers.map((p) => (
                      <td key={p.id} className="px-1 py-1 text-center text-muted">
                        {strokePreview.find((r) => r.player_id === p.id)?.netTotal ?? "–"}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              )}
              {modality === "stableford" && (
                <tfoot>
                  <tr className="border-t-2 border-border font-semibold">
                    <td className="px-1 py-2" colSpan={2}>
                      Puntos
                    </td>
                    {selectedPlayers.map((p) => (
                      <td key={p.id} className="px-1 py-2 text-center">
                        {stablefordPreview.find((r) => r.player_id === p.id)?.points ?? "–"}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {isMatch && (
            <div className="mt-3 rounded-md bg-background p-3 text-sm">
              {matchPreview ? (
                matchPreview.outcome === "in_progress" ? (
                  <span className="text-muted">Partido en juego…</span>
                ) : matchPreview.outcome === "halved" ? (
                  <span className="font-medium">Empate (AS)</span>
                ) : (
                  <span className="font-medium">
                    Va ganando el equipo {matchPreview.outcome === "team_a" ? "A" : "B"} (
                    {matchPreview.statusLabel})
                  </span>
                )
              ) : (
                <span className="text-muted">Completa ambos equipos para ver el resultado.</span>
              )}
            </div>
          )}
        </section>
      )}

      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={pending}
        className="rounded-md bg-primary px-4 py-3 font-medium text-primary-foreground hover:bg-primary-dark disabled:opacity-60"
      >
        {pending ? "Guardando…" : "Guardar resultado"}
      </button>
    </div>
  );
}

function HandicapInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-muted">Hcp</span>
      <input
        type="number"
        step="0.1"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-16 rounded-md border border-border px-2 py-1 text-sm"
      />
    </div>
  );
}

function TeamPicker({
  label,
  players,
  selected,
  other,
  handicaps,
  onToggle,
  onHandicapChange,
}: {
  label: string;
  players: Player[];
  selected: string[];
  other: string[];
  handicaps: Record<string, number>;
  onToggle: (id: string, player: Player) => void;
  onHandicapChange: (id: string, v: number) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium">{label}</p>
      <div className="flex flex-col gap-2">
        {players.map((p) => {
          const checked = selected.includes(p.id);
          const disabled = other.includes(p.id);
          return (
            <div key={p.id} className="flex items-center gap-2">
              <label className="flex flex-1 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => onToggle(p.id, p)}
                  className="h-4 w-4 min-h-0 accent-primary disabled:opacity-40"
                />
                <span className={disabled ? "opacity-40" : ""}>{p.full_name}</span>
              </label>
              {checked && (
                <HandicapInput
                  value={handicaps[p.id] ?? p.handicap}
                  onChange={(v) => onHandicapChange(p.id, v)}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StrokeStepper({
  value,
  onChange,
  defaultValue,
}: {
  value: number | undefined;
  onChange: (v: number) => void;
  defaultValue: number;
}) {
  const current = value ?? null;
  return (
    <div className="flex items-center justify-center gap-1">
      <button
        type="button"
        aria-label="Restar golpe"
        onClick={() => onChange((current ?? defaultValue) - 1)}
        className="flex h-8 w-8 min-h-0 items-center justify-center rounded-md border border-border"
      >
        <Minus size={14} />
      </button>
      <span className="w-6 text-center tabular-nums">{current ?? "–"}</span>
      <button
        type="button"
        aria-label="Sumar golpe"
        onClick={() => onChange((current ?? defaultValue) + 1)}
        className="flex h-8 w-8 min-h-0 items-center justify-center rounded-md border border-border"
      >
        <Plus size={14} />
      </button>
    </div>
  );
}
