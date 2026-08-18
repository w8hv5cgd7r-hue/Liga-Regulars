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
  if (payload.scores.length === 0) {
    return { ok: false, error: "No se ha introducido ningún resultado." };
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

  const { data: round, error: roundError } = await supabase
    .from("rounds")
    .insert({
      course_id: payload.course_id,
      season_id: payload.season_id,
      played_on: payload.played_on,
      notes: payload.notes || null,
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
