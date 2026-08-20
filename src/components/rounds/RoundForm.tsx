"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Minus, Plus } from "lucide-react";
import { createRoundAction, saveHoleScoreAction, updateRoundAction } from "@/lib/actions/round-actions";
import {
  computeMatchPlay,
  computeStableford,
  computeStrokePlay,
  type HoleInfo,
  type PlayerHoleScores,
} from "@/lib/scoring/engine";
import {
  hasBackNine,
  parPlayed,
  runningMatchStatuses,
  sideTextClass,
  splitFrontBack,
  summarizeMatchHoles,
  toParLabel,
  upDownLabel,
} from "@/lib/scoring/segments";
import { RoundLeaderboard, type LeaderboardRow } from "@/components/rounds/RoundLeaderboard";
import {
  MODALITY_LABEL,
  MODALITY_SHORT,
  type CourseWithHoles,
  type Modality,
  type Player,
  type RoundFull,
  type Season,
} from "@/lib/types";
import { formatDateEs } from "@/lib/format";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

const MODALITY_ORDER: Modality[] = ["stroke", "stableford", "match1v1", "matchpairs"];

export function RoundForm({
  players,
  courses,
  seasons,
  initialRound,
}: {
  players: Player[];
  courses: CourseWithHoles[];
  seasons: Season[];
  /** Si se pasa, el formulario edita esta partida en vez de crear una nueva. */
  initialRound?: RoundFull;
}) {
  const router = useRouter();
  const isEdit = !!initialRound;
  const initialIsMatch =
    initialRound?.season.modality === "match1v1" || initialRound?.season.modality === "matchpairs";

  // En una partida nueva se pasa primero por el "setup" (temporada, campo,
  // fecha, quién juega, hándicap sí/no); al continuar se guarda la ronda y
  // se pasa a la fase de "tarjeta" para ir metiendo los golpes. Al editar
  // una partida ya existente se muestra todo junto, como antes.
  const [step, setStep] = useState<"setup" | "card">(isEdit ? "card" : "setup");
  const [savedRoundId, setSavedRoundId] = useState<string | null>(initialRound?.id ?? null);

  const [seasonId, setSeasonId] = useState(initialRound?.season_id ?? seasons[0]?.id ?? "");
  const [courseId, setCourseId] = useState(initialRound?.course_id ?? courses[0]?.id ?? "");
  const [playedOn, setPlayedOn] = useState(initialRound?.played_on ?? todayISO());
  const [notes, setNotes] = useState(initialRound?.notes ?? "");
  const [useHandicap, setUseHandicap] = useState(initialRound?.use_handicap ?? true);

  // golpes / stableford
  const [selectedIds, setSelectedIds] = useState<string[]>(
    initialRound && !initialIsMatch ? initialRound.players.map((p) => p.player_id) : []
  );
  // match1v1 / matchpairs
  const [teamA, setTeamA] = useState<string[]>(initialRound?.team_a ?? []);
  const [teamB, setTeamB] = useState<string[]>(initialRound?.team_b ?? []);

  const [handicaps, setHandicaps] = useState<Record<string, number>>(
    initialRound ? Object.fromEntries(initialRound.players.map((p) => [p.player_id, p.handicap])) : {}
  );
  const [scores, setScores] = useState<Record<string, Record<number, number>>>(() => {
    if (!initialRound) return {};
    const map: Record<string, Record<number, number>> = {};
    for (const s of initialRound.scores) {
      map[s.player_id] = { ...(map[s.player_id] ?? {}), [s.hole_number]: s.strokes };
    }
    return map;
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Estado de guardado de cada hoyo, hoyo a hoyo, para pintarlo en la
  // tarjeta ("guardando…" / "guardado" / "error") sin esperar a "Guardar
  // resultado". Clave: "playerId:holeNumber".
  const [cellStatus, setCellStatus] = useState<Record<string, "saving" | "error">>({});
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  useEffect(() => {
    const timers = saveTimers.current;
    return () => {
      Object.values(timers).forEach(clearTimeout);
    };
  }, []);

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

  // Guarda el golpe de un hoyo en Supabase en cuanto se deja de tocar ese
  // hoyo un momento (debounce corto), en vez de esperar a "Guardar
  // resultado". Así queda guardado mientras se juega y, gracias a
  // LiveRoundWatcher, los compañeros que tengan la partida abierta lo ven
  // casi al instante.
  function scheduleHoleSave(playerId: string, holeNumber: number, strokes: number) {
    if (!savedRoundId) return; // la tarjeta solo se ve una vez creada la ronda
    const key = `${playerId}:${holeNumber}`;
    setCellStatus((prev) => ({ ...prev, [key]: "saving" }));
    if (saveTimers.current[key]) clearTimeout(saveTimers.current[key]);
    saveTimers.current[key] = setTimeout(async () => {
      const result = await saveHoleScoreAction({
        round_id: savedRoundId,
        player_id: playerId,
        hole_number: holeNumber,
        strokes,
      });
      setCellStatus((prev) => {
        const next = { ...prev };
        if (result.ok) delete next[key];
        else next[key] = "error";
        return next;
      });
    }, 600);
  }

  function cellStatusClass(playerId: string, holeNumber: number): string {
    const status = cellStatus[`${playerId}:${holeNumber}`];
    if (status === "saving") return "bg-accent/10";
    if (status === "error") return "bg-red-50";
    if (scores[playerId]?.[holeNumber] != null) return "bg-primary/5";
    return "";
  }

  function holeComplete(holeNumber: number): boolean {
    return (
      selectedPlayers.length > 0 &&
      selectedPlayers.every((p) => scores[p.id]?.[holeNumber] != null)
    );
  }

  function setScore(playerId: string, holeNumber: number, value: number) {
    const clamped = Math.max(1, Math.min(15, value));
    setScores((prev) => ({
      ...prev,
      [playerId]: { ...prev[playerId], [holeNumber]: clamped },
    }));
    scheduleHoleSave(playerId, holeNumber, clamped);
  }

  function fillPar(playerId: string) {
    const next: Record<number, number> = { ...scores[playerId] };
    const filledHoles: number[] = [];
    for (const h of holes) {
      if (next[h.hole_number] == null) {
        next[h.hole_number] = h.par;
        filledHoles.push(h.hole_number);
      }
    }
    setScores((prev) => ({ ...prev, [playerId]: next }));
    for (const holeNumber of filledHoles) {
      scheduleHoleSave(playerId, holeNumber, next[holeNumber]);
    }
  }

  // Vista previa en vivo del resultado con lo que se lleva introducido.
  const holeInfos: HoleInfo[] = holes.map((h) => ({
    hole_number: h.hole_number,
    par: h.par,
    stroke_index: h.stroke_index,
  }));
  const { front: frontHoles, back: backHoles } = splitFrontBack(holeInfos);
  const showBackNine = hasBackNine(holeInfos);

  const playerScoresForEngine: PlayerHoleScores[] = selectedPlayers.map((p) => ({
    player_id: p.id,
    handicap: useHandicap ? handicaps[p.id] ?? p.handicap : 0,
    strokes: scores[p.id] ?? {},
  }));

  // Se calcula siempre (no solo en modalidad golpes) porque también se
  // muestra como resultado de golpes dentro del resumen de match play.
  const strokeTotal = holeInfos.length ? computeStrokePlay(holeInfos, playerScoresForEngine) : [];
  const strokeFront =
    modality === "stroke" && frontHoles.length ? computeStrokePlay(frontHoles, playerScoresForEngine) : [];
  const strokeBack =
    modality === "stroke" && backHoles.length ? computeStrokePlay(backHoles, playerScoresForEngine) : [];

  const stablefordTotal =
    modality === "stableford" && holeInfos.length
      ? computeStableford(holeInfos, playerScoresForEngine)
      : [];
  const stablefordFront =
    modality === "stableford" && frontHoles.length
      ? computeStableford(frontHoles, playerScoresForEngine)
      : [];
  const stablefordBack =
    modality === "stableford" && backHoles.length
      ? computeStableford(backHoles, playerScoresForEngine)
      : [];

  const matchPreview =
    isMatch && holeInfos.length && teamA.length === teamSize && teamB.length === teamSize
      ? computeMatchPlay(holeInfos, playerScoresForEngine, teamA, teamB)
      : null;
  const matchFrontSummary = matchPreview
    ? summarizeMatchHoles(matchPreview.holes.filter((h) => h.hole_number <= 9))
    : null;
  const matchBackSummary = matchPreview
    ? summarizeMatchHoles(matchPreview.holes.filter((h) => h.hole_number > 9))
    : null;
  const matchTotalSummary = matchPreview ? summarizeMatchHoles(matchPreview.holes) : null;
  const matchRunning = matchPreview ? runningMatchStatuses(matchPreview.holes) : [];
  const teamAName = teamA.map((id) => players.find((p) => p.id === id)?.full_name).join(" y ");
  const teamBName = teamB.map((id) => players.find((p) => p.id === id)?.full_name).join(" y ");
  const matchLeaderColorClass =
    matchTotalSummary && matchTotalSummary.wonA !== matchTotalSummary.wonB
      ? matchTotalSummary.wonA > matchTotalSummary.wonB
        ? "text-primary"
        : "text-accent"
      : "";

  function buildPayload() {
    setError(null);
    if (!season) {
      setError("Elige una temporada.");
      return null;
    }
    if (!courseId || !playedOn) {
      setError("Elige campo y fecha.");
      return null;
    }
    if (isMatch) {
      if (teamA.length !== teamSize || teamB.length !== teamSize) {
        setError(
          modality === "match1v1"
            ? "Elige un jugador para cada lado."
            : `Elige ${teamSize} jugadores para cada pareja.`
        );
        return null;
      }
    } else if (selectedIds.length === 0) {
      setError("Selecciona al menos un jugador.");
      return null;
    }

    const scoreRows = selectedPlayers.flatMap((p) =>
      Object.entries(scores[p.id] ?? {}).map(([hole, strokes]) => ({
        player_id: p.id,
        hole_number: Number(hole),
        strokes,
      }))
    );

    return {
      course_id: courseId,
      season_id: seasonId,
      played_on: playedOn,
      notes,
      use_handicap: useHandicap,
      players: selectedPlayers.map((p) => ({
        player_id: p.id,
        handicap: handicaps[p.id] ?? p.handicap,
      })),
      scores: scoreRows,
      team_a: isMatch ? teamA : undefined,
      team_b: isMatch ? teamB : undefined,
    };
  }

  function handleContinue() {
    const payload = buildPayload();
    if (!payload) return;
    startTransition(async () => {
      const result = savedRoundId
        ? await updateRoundAction({ id: savedRoundId, ...payload })
        : await createRoundAction(payload);
      if (!result.ok) {
        setError(result.error ?? "No se pudo guardar la partida.");
        return;
      }
      setSavedRoundId(result.roundId ?? savedRoundId);
      setStep("card");
    });
  }

  function handleSave() {
    const payload = buildPayload();
    if (!payload) return;
    const id = initialRound?.id ?? savedRoundId;
    startTransition(async () => {
      const result = id
        ? await updateRoundAction({ id, ...payload })
        : await createRoundAction(payload);
      if (!result.ok) {
        setError(result.error ?? "No se pudo guardar la partida.");
        return;
      }
      router.push(`/rounds/${result.roundId ?? id}`);
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

  const showSetup = step === "setup" || isEdit;
  const showCard = step === "card" || isEdit;

  return (
    <div className="flex flex-col gap-5 pb-6">
      {showSetup && (
        <>
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

            <div className="mt-4">
              <label className="mb-1 block text-xs text-muted">¿Se juega con hándicap?</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setUseHandicap(true)}
                  className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium ${
                    useHandicap
                      ? "border-primary bg-primary/10 text-primary-dark"
                      : "border-border text-muted"
                  }`}
                >
                  Con hándicap
                </button>
                <button
                  type="button"
                  onClick={() => setUseHandicap(false)}
                  className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium ${
                    !useHandicap
                      ? "border-primary bg-primary/10 text-primary-dark"
                      : "border-border text-muted"
                  }`}
                >
                  Sin hándicap (scratch)
                </button>
              </div>
              {!useHandicap && (
                <p className="mt-1 text-xs text-muted">
                  Se jugará como si todos tuvierais hándicap 0: no se reparten golpes por hoyo.
                </p>
              )}
            </div>
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
        </>
      )}

      {!isEdit && step === "card" && (
        <section className="rounded-lg border border-border bg-card p-3">
          <p className="text-sm">
            <span className="font-medium">{course?.name}</span> · {formatDateEs(playedOn)} ·{" "}
            {modality && MODALITY_SHORT[modality]} · {season?.name} ·{" "}
            <span className={useHandicap ? "" : "text-accent"}>
              {useHandicap ? "con hándicap" : "sin hándicap"}
            </span>
          </p>
          <p className="mt-1 text-xs text-muted">
            {isMatch ? (
              <>
                <span className="font-medium text-primary">{teamAName}</span>{" "}
                <span className="text-muted">vs</span>{" "}
                <span className="font-medium text-accent">{teamBName}</span>
              </>
            ) : (
              selectedPlayers.map((p) => p.full_name).join(", ")
            )}
          </p>
        </section>
      )}

      {showCard && holes.length > 0 && selectedPlayers.length > 0 && (
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
                        <span
                          className={`whitespace-nowrap font-medium ${
                            isMatch ? sideTextClass(p.id, teamA, teamB) : ""
                          }`}
                        >
                          {p.full_name.split(" ")[0]}
                        </span>
                        <button
                          type="button"
                          onClick={() => fillPar(p.id)}
                          className="text-[11px] font-medium text-primary underline"
                        >
                          rellenar par
                        </button>
                      </div>
                    </th>
                  ))}
                  {isMatch && <th className="w-14 px-1 py-1 text-center">Resultado</th>}
                </tr>
              </thead>

              <tbody>
                {(showBackNine ? frontHoles : holeInfos).map((h) => (
                  <tr
                    key={h.hole_number}
                    className={`border-t border-border ${holeComplete(h.hole_number) ? "bg-primary/5" : ""}`}
                  >
                    <td className="px-1 py-1 font-medium">
                      <span className="inline-flex items-center gap-1">
                        {h.hole_number}
                        {holeComplete(h.hole_number) && (
                          <Check size={12} className="text-primary" aria-label="Hoyo ya jugado" />
                        )}
                      </span>
                      <span className="ml-1 text-[11px] text-muted">SI{h.stroke_index}</span>
                    </td>
                    <td className="px-1 py-1 text-muted">{h.par}</td>
                    {selectedPlayers.map((p) => (
                      <td key={p.id} className={`px-1 py-1 ${cellStatusClass(p.id, h.hole_number)}`}>
                        <StrokeStepper
                          value={scores[p.id]?.[h.hole_number]}
                          onChange={(v) => setScore(p.id, h.hole_number, v)}
                          defaultValue={h.par}
                        />
                      </td>
                    ))}
                    {isMatch && <MatchStatusCell running={matchRunning} holeNumber={h.hole_number} />}
                  </tr>
                ))}
              </tbody>

              {showBackNine && (
                <>
                  <SubtotalRow
                    label="Ida"
                    modality={modality}
                    players={selectedPlayers}
                    strokeRows={strokeFront}
                    stablefordRows={stablefordFront}
                  />
                  <tbody>
                    {backHoles.map((h) => (
                      <tr
                        key={h.hole_number}
                        className={`border-t border-border ${holeComplete(h.hole_number) ? "bg-primary/5" : ""}`}
                      >
                        <td className="px-1 py-1 font-medium">
                          <span className="inline-flex items-center gap-1">
                            {h.hole_number}
                            {holeComplete(h.hole_number) && (
                              <Check size={12} className="text-primary" aria-label="Hoyo ya jugado" />
                            )}
                          </span>
                          <span className="ml-1 text-[11px] text-muted">SI{h.stroke_index}</span>
                        </td>
                        <td className="px-1 py-1 text-muted">{h.par}</td>
                        {selectedPlayers.map((p) => (
                          <td key={p.id} className={`px-1 py-1 ${cellStatusClass(p.id, h.hole_number)}`}>
                            <StrokeStepper
                              value={scores[p.id]?.[h.hole_number]}
                              onChange={(v) => setScore(p.id, h.hole_number, v)}
                              defaultValue={h.par}
                            />
                          </td>
                        ))}
                        {isMatch && <MatchStatusCell running={matchRunning} holeNumber={h.hole_number} />}
                      </tr>
                    ))}
                  </tbody>
                  <SubtotalRow
                    label="Vuelta"
                    modality={modality}
                    players={selectedPlayers}
                    strokeRows={strokeBack}
                    stablefordRows={stablefordBack}
                  />
                </>
              )}

              {modality === "stroke" && (
                <tfoot>
                  <tr className="border-t-2 border-border font-semibold">
                    <td className="px-1 py-2" colSpan={2}>
                      Total bruto
                    </td>
                    {selectedPlayers.map((p) => (
                      <td key={p.id} className="px-1 py-2 text-center">
                        {strokeTotal.find((r) => r.player_id === p.id)?.grossTotal ?? "–"}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="px-1 py-1 text-muted" colSpan={2}>
                      Total neto
                    </td>
                    {selectedPlayers.map((p) => (
                      <td key={p.id} className="px-1 py-1 text-center text-muted">
                        {strokeTotal.find((r) => r.player_id === p.id)?.netTotal ?? "–"}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              )}
              {modality === "stableford" && (
                <tfoot>
                  <tr className="border-t-2 border-border font-semibold">
                    <td className="px-1 py-2" colSpan={2}>
                      Total puntos
                    </td>
                    {selectedPlayers.map((p) => (
                      <td key={p.id} className="px-1 py-2 text-center">
                        {stablefordTotal.find((r) => r.player_id === p.id)?.points ?? "–"}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          <p className="mt-2 text-xs text-muted">
            Cada golpe se guarda solo, hoyo a hoyo, según lo metes: fondo{" "}
            <span className="font-semibold text-accent">ámbar</span> mientras se guarda,{" "}
            <span className="font-semibold text-primary">verde</span> cuando ya está guardado. El{" "}
            <Check size={11} className="inline text-primary" aria-hidden /> junto al número de hoyo indica que
            ya han metido su golpe todos los jugadores de esa tarjeta. Con + o - el primer toque deja el
            resultado en par y a partir de ahí ya suma o resta de uno en uno; también puedes tocar el número
            para escribirlo directamente con el teclado numérico del móvil.
          </p>

          {isMatch && (
            <p className="mt-1 text-xs text-muted">
              Columna «Resultado»: <span className="font-semibold text-primary">verde</span> ={" "}
              {teamAName || "equipo A"} arriba · <span className="font-semibold text-accent">ámbar</span> ={" "}
              {teamBName || "equipo B"} arriba · AS = empatados.
            </p>
          )}

          {(modality === "stroke" || modality === "stableford") && (
            <div className="mt-4 border-t border-border pt-3">
              <h3 className="mb-2 text-sm font-semibold">Clasificación en vivo</h3>
              <RoundLeaderboard
                rows={
                  modality === "stroke"
                    ? strokeTotal
                        .filter((r) => r.holesPlayed > 0)
                        .map((r): LeaderboardRow => {
                          const strokes = scores[r.player_id] ?? {};
                          return {
                            player_id: r.player_id,
                            name:
                              selectedPlayers.find((p) => p.id === r.player_id)?.full_name.split(" ")[0] ??
                              "?",
                            main: r.netTotal,
                            mainLabel: "Neto",
                            toPar: toParLabel(r.netTotal, parPlayed(holeInfos, strokes)),
                            thru: `${r.holesPlayed}/${holeInfos.length}`,
                            extra: `bruto ${r.grossTotal}`,
                          };
                        })
                    : stablefordTotal
                        .filter((r) => r.holesPlayed > 0)
                        .map((r): LeaderboardRow => ({
                          player_id: r.player_id,
                          name:
                            selectedPlayers.find((p) => p.id === r.player_id)?.full_name.split(" ")[0] ??
                            "?",
                          main: r.points,
                          mainLabel: "Puntos",
                          thru: `${r.holesPlayed}/${holeInfos.length}`,
                          extra: `bruto ${r.grossTotal}`,
                        }))
                }
                emptyLabel="Empieza a meter golpes para ver la clasificación."
              />
            </div>
          )}

          {isMatch && (
            <div className="mt-3 rounded-md bg-background p-3 text-sm">
              {matchPreview ? (
                <div className="flex flex-col gap-2">
                  <div>
                    {matchTotalSummary && matchTotalSummary.thru === 0 ? (
                      <span className="text-muted">Partido sin empezar.</span>
                    ) : matchPreview.outcome === "in_progress" ? (
                      <span className="font-medium">
                        <span className={matchLeaderColorClass}>
                          {upDownLabel(matchTotalSummary!, teamAName, teamBName)}
                        </span>{" "}
                        · thru {matchTotalSummary!.thru}
                      </span>
                    ) : matchPreview.outcome === "halved" ? (
                      <span className="font-medium">Empate (AS)</span>
                    ) : (
                      <span className="font-medium">
                        Gana{" "}
                        <span className={matchPreview.outcome === "team_a" ? "text-primary" : "text-accent"}>
                          {matchPreview.outcome === "team_a" ? teamAName : teamBName}
                        </span>{" "}
                        ({matchPreview.statusLabel})
                      </span>
                    )}
                  </div>
                  {showBackNine && (
                    <div className="grid grid-cols-3 gap-2 text-xs text-muted">
                      <div>
                        <span className="block font-medium text-foreground">Ida</span>
                        {matchFrontSummary!.wonA}-{matchFrontSummary!.wonB}
                        {matchFrontSummary!.halved ? ` (${matchFrontSummary!.halved} emp.)` : ""}
                      </div>
                      <div>
                        <span className="block font-medium text-foreground">Vuelta</span>
                        {matchBackSummary!.wonA}-{matchBackSummary!.wonB}
                        {matchBackSummary!.halved ? ` (${matchBackSummary!.halved} emp.)` : ""}
                      </div>
                      <div>
                        <span className="block font-medium text-foreground">Total</span>
                        {matchTotalSummary!.wonA}-{matchTotalSummary!.wonB}
                        {matchTotalSummary!.halved ? ` (${matchTotalSummary!.halved} emp.)` : ""}
                      </div>
                    </div>
                  )}
                  <div className="border-t border-border pt-2">
                    <span className="block text-xs font-medium text-foreground">
                      Resultado de golpes {useHandicap ? "(neto)" : "(sin hándicap)"}
                    </span>
                    <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted">
                      {selectedPlayers.map((p) => {
                        const row = strokeTotal.find((r) => r.player_id === p.id);
                        return (
                          <div key={p.id} className="flex items-center justify-between">
                            <span className={`font-medium ${sideTextClass(p.id, teamA, teamB)}`}>
                              {p.full_name.split(" ")[0]}
                            </span>
                            <span>
                              {useHandicap
                                ? `${row?.netTotal ?? "–"} (bruto ${row?.grossTotal ?? "–"})`
                                : (row?.grossTotal ?? "–")}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
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

      {!isEdit && step === "setup" && (
        <button
          type="button"
          onClick={handleContinue}
          disabled={pending}
          className="rounded-md bg-primary px-4 py-3 font-medium text-primary-foreground hover:bg-primary-dark disabled:opacity-60"
        >
          {pending ? "Guardando…" : "Continuar →"}
        </button>
      )}

      {showCard && (
        <>
          <p className="text-center text-xs text-muted">
            Los golpes ya se van guardando solos mientras juegas. Pulsa este botón cuando termines de
            jugar, para {isEdit ? "confirmar los cambios y volver" : "salir"} a ver la partida completa.
          </p>
          <button
            type="button"
            onClick={handleSave}
            disabled={pending}
            className="rounded-md bg-primary px-4 py-3 font-medium text-primary-foreground hover:bg-primary-dark disabled:opacity-60"
          >
            {pending ? "Guardando…" : isEdit ? "Guardar cambios" : "Guardar resultado"}
          </button>
        </>
      )}
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

function SubtotalRow({
  label,
  modality,
  players,
  strokeRows,
  stablefordRows,
}: {
  label: string;
  modality: Modality | undefined;
  players: Player[];
  strokeRows: ReturnType<typeof computeStrokePlay>;
  stablefordRows: ReturnType<typeof computeStableford>;
}) {
  if (modality !== "stroke" && modality !== "stableford") return null;
  return (
    <tbody>
      <tr className="border-t-2 border-border bg-background font-medium">
        <td className="px-1 py-1" colSpan={2}>
          {label}
        </td>
        {players.map((p) => (
          <td key={p.id} className="px-1 py-1 text-center">
            {modality === "stroke"
              ? (strokeRows.find((r) => r.player_id === p.id)?.netTotal ?? "–")
              : (stablefordRows.find((r) => r.player_id === p.id)?.points ?? "–")}
          </td>
        ))}
      </tr>
    </tbody>
  );
}

function MatchStatusCell({
  running,
  holeNumber,
}: {
  running: ReturnType<typeof runningMatchStatuses>;
  holeNumber: number;
}) {
  const status = running.find((r) => r.hole_number === holeNumber);
  return (
    <td
      className={`px-1 py-1 text-center text-xs font-semibold tabular-nums ${
        status?.leader === "a" ? "text-primary" : status?.leader === "b" ? "text-accent" : "text-muted"
      }`}
    >
      {status?.label || "–"}
    </td>
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
  // El primer toque (a "+" o a "-", da igual cuál) deja el resultado en par,
  // que es el punto de partida más habitual; a partir de ahí, cada toque ya
  // suma o resta un golpe normal. Así se evita tener que subir y luego bajar
  // (o al revés) para dejarlo en el número exacto que se ha hecho.
  return (
    <div className="flex items-center justify-center gap-1">
      <button
        type="button"
        aria-label="Restar golpe"
        onClick={() => onChange(current == null ? defaultValue : current - 1)}
        className="flex h-8 w-8 min-h-0 items-center justify-center rounded-md border border-border"
      >
        <Minus size={14} />
      </button>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={2}
        value={current ?? ""}
        placeholder="–"
        aria-label="Golpes de este hoyo (toca para escribir el número)"
        onFocus={(e) => e.target.select()}
        onChange={(e) => {
          const digits = e.target.value.replace(/[^0-9]/g, "");
          if (digits === "") return;
          const n = Number(digits);
          if (!Number.isNaN(n) && n > 0) onChange(n);
        }}
        className="h-8 w-8 rounded-md border border-transparent bg-transparent text-center tabular-nums focus:border-border focus:outline-none focus:ring-1 focus:ring-primary"
      />
      <button
        type="button"
        aria-label="Sumar golpe"
        onClick={() => onChange(current == null ? defaultValue : current + 1)}
        className="flex h-8 w-8 min-h-0 items-center justify-center rounded-md border border-border"
      >
        <Plus size={14} />
      </button>
    </div>
  );
}
