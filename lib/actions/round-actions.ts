"use server";

import { revalidatePath } from "next/cache";
import { requireActivePlayer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Modality } from "@/lib/types";

export interface CreateRoundPayload {
  course_id: string;
  season_id: string;
  played_on: string;
  notes?: string;
  /** Si es false, se juega sin hándicap (scratch, como si todos tuvieran 0). Por defecto true. */
  use_handicap?: boolean;
  players: { player_id: string; handicap: number }[];
  scores: { player_id: string; hole_number: number; strokes: number }[];
  /** Solo para temporadas de modalidad match1v1 (1 id) o matchpairs (2 ids). */
  team_a?: string[];
  team_b?: string[];
}

export interface CreateRoundResult {
  ok: boolean;
  error?: string;
  roundId?: string;
}

const MATCH_MODALITIES: Modality[] = ["match1v1", "matchpairs"];

export async function createRoundAction(payload: CreateRoundPayload): Promise<CreateRoundResult> {
  const me = await requireActivePlayer();
  const supabase = await createClient();

  if (!payload.course_id || !payload.season_id || !payload.played_on) {
    return { ok: false, error: "Falta el campo, la temporada o la fecha." };
  }
  if (payload.players.length < 1) {
    return { ok: false, error: "Selecciona al menos un jugador." };
  }
  // Nota: no se exige que ya haya golpes apuntados aquí. El flujo en dos fases
  // guarda la partida en cuanto se pulsa "Continuar" (fase "setup"), antes de
  // que se haya metido ningún resultado en la tarjeta; eso es intencional.

  const { data: season, error: seasonError } = await supabase
    .from("seasons")
    .select("modality")
    .eq("id", payload.season_id)
    .single();
  if (seasonError || !season) {
    return { ok: false, error: "La temporada seleccionada no existe." };
  }
  const modality = season.modality as Modality;

  const teamA = payload.team_a ?? [];
  const teamB = payload.team_b ?? [];
  if (MATCH_MODALITIES.includes(modality)) {
    const expectedSize = modality === "match1v1" ? 1 : 2;
    if (teamA.length !== expectedSize || teamB.length !== expectedSize) {
      return {
        ok: false,
        error:
          modality === "match1v1"
            ? "Elige un jugador para cada lado del 1 contra 1."
            : "Elige 2 jugadores para cada pareja.",
      };
    }
    if (teamA.some((id) => teamB.includes(id))) {
      return { ok: false, error: "Un jugador no puede estar en los dos equipos." };
    }
  }

  const { data: round, error: roundError } = await supabase
    .from("rounds")
    .insert({
      course_id: payload.course_id,
      season_id: payload.season_id,
      played_on: payload.played_on,
      notes: payload.notes || null,
      use_handicap: payload.use_handicap ?? true,
      team_a: MATCH_MODALITIES.includes(modality) ? teamA : null,
      team_b: MATCH_MODALITIES.includes(modality) ? teamB : null,
      created_by: me.id,
    })
    .select("id")
    .single();

  if (roundError || !round) {
    return { ok: false, error: roundError?.message ?? "No se pudo crear la partida." };
  }
  const roundId = round.id as string;

  const cleanup = async (message: string) => {
    await supabase.from("rounds").delete().eq("id", roundId);
    return { ok: false, error: message };
  };

  const { error: playersError } = await supabase.from("round_players").insert(
    payload.players.map((p) => ({ round_id: roundId, player_id: p.player_id, handicap: p.handicap }))
  );
  if (playersError) return await cleanup(playersError.message);

  const { error: scoresError } = await supabase.from("hole_scores").insert(
    payload.scores.map((s) => ({
      round_id: roundId,
      player_id: s.player_id,
      hole_number: s.hole_number,
      strokes: s.strokes,
    }))
  );
  if (scoresError) return await cleanup(scoresError.message);

  revalidatePath("/rounds");
  revalidatePath("/clasificaciones");
  revalidatePath("/");
  return { ok: true, roundId };
}

export interface UpdateRoundPayload extends CreateRoundPayload {
  id: string;
}

export async function updateRoundAction(payload: UpdateRoundPayload): Promise<CreateRoundResult> {
  const me = await requireActivePlayer();
  const supabase = await createClient();

  if (!payload.course_id || !payload.season_id || !payload.played_on) {
    return { ok: false, error: "Falta el campo, la temporada o la fecha." };
  }
  if (payload.players.length < 1) {
    return { ok: false, error: "Selecciona al menos un jugador." };
  }

  const { data: existing, error: existingError } = await supabase
    .from("rounds")
    .select("created_by")
    .eq("id", payload.id)
    .single();
  if (existingError || !existing) {
    return { ok: false, error: "La partida no existe." };
  }
  if (me.role !== "admin" && existing.created_by !== me.id) {
    return { ok: false, error: "No tienes permiso para editar esta partida." };
  }

  const { data: season, error: seasonError } = await supabase
    .from("seasons")
    .select("modality")
    .eq("id", payload.season_id)
    .single();
  if (seasonError || !season) {
    return { ok: false, error: "La temporada seleccionada no existe." };
  }
  const modality = season.modality as Modality;

  const teamA = payload.team_a ?? [];
  const teamB = payload.team_b ?? [];
  if (MATCH_MODALITIES.includes(modality)) {
    const expectedSize = modality === "match1v1" ? 1 : 2;
    if (teamA.length !== expectedSize || teamB.length !== expectedSize) {
      return {
        ok: false,
        error:
          modality === "match1v1"
            ? "Elige un jugador para cada lado del 1 contra 1."
            : "Elige 2 jugadores para cada pareja.",
      };
    }
    if (teamA.some((id) => teamB.includes(id))) {
      return { ok: false, error: "Un jugador no puede estar en los dos equipos." };
    }
  }

  const { error: roundError } = await supabase
    .from("rounds")
    .update({
      course_id: payload.course_id,
      season_id: payload.season_id,
      played_on: payload.played_on,
      notes: payload.notes || null,
      use_handicap: payload.use_handicap ?? true,
      team_a: MATCH_MODALITIES.includes(modality) ? teamA : null,
      team_b: MATCH_MODALITIES.includes(modality) ? teamB : null,
    })
    .eq("id", payload.id);
  if (roundError) return { ok: false, error: roundError.message };

  // Sustituimos la lista de jugadores por la nueva.
  const { error: deletePlayersError } = await supabase
    .from("round_players")
    .delete()
    .eq("round_id", payload.id);
  if (deletePlayersError) return { ok: false, error: deletePlayersError.message };

  const { error: playersError } = await supabase.from("round_players").insert(
    payload.players.map((p) => ({ round_id: payload.id, player_id: p.player_id, handicap: p.handicap }))
  );
  if (playersError) return { ok: false, error: playersError.message };

  // Los golpes de cada hoyo ya NO se reemplazan aquí en bloque: se guardan
  // uno a uno según se van metiendo (ver saveHoleScoreAction más abajo), así
  // que "Guardar cambios" no los toca para no provocar parpadeos a quien
  // esté viendo la partida en vivo (un borrado+reinserción se notaría como
  // "desaparecen y vuelven" en tiempo real). Lo único que hace falta aquí es
  // limpiar los golpes de jugadores que se hayan quitado de la partida.
  const newPlayerIds = payload.players.map((p) => p.player_id);
  if (newPlayerIds.length > 0) {
    const { error: cleanupError } = await supabase
      .from("hole_scores")
      .delete()
      .eq("round_id", payload.id)
      .not("player_id", "in", `(${newPlayerIds.join(",")})`);
    if (cleanupError) return { ok: false, error: cleanupError.message };
  }

  revalidatePath("/rounds");
  revalidatePath(`/rounds/${payload.id}`);
  revalidatePath("/clasificaciones");
  revalidatePath("/");
  return { ok: true, roundId: payload.id };
}

export interface SaveHoleScorePayload {
  round_id: string;
  player_id: string;
  hole_number: number;
  strokes: number;
}

/**
 * Guarda (o actualiza) el resultado de UN solo hoyo de UN jugador, al momento
 * de meterlo en la tarjeta, en vez de esperar a "Guardar resultado". Así
 * queda guardado hoyo a hoyo mientras se juega, y quien tenga la partida
 * abierta en su móvil lo ve casi al instante (ver LiveRoundWatcher, que
 * escucha cambios en `hole_scores` por Supabase Realtime).
 */
export async function saveHoleScoreAction(payload: SaveHoleScorePayload): Promise<CreateRoundResult> {
  await requireActivePlayer();
  const supabase = await createClient();

  const { error } = await supabase.from("hole_scores").upsert(
    {
      round_id: payload.round_id,
      player_id: payload.player_id,
      hole_number: payload.hole_number,
      strokes: payload.strokes,
    },
    { onConflict: "round_id,player_id,hole_number" }
  );
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/rounds/${payload.round_id}`);
  revalidatePath("/clasificaciones");
  revalidatePath("/");
  return { ok: true, roundId: payload.round_id };
}

export async function deleteRoundAction(id: string): Promise<CreateRoundResult> {
  await requireActivePlayer();
  const supabase = await createClient();
  const { error } = await supabase.from("rounds").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/rounds");
  revalidatePath("/clasificaciones");
  revalidatePath("/");
  return { ok: true };
}
