import { createClient } from "@/lib/supabase/server";
import type { CourseHole, HoleScore, Round, RoundFull, RoundPlayer, Season } from "@/lib/types";
import { getAllCoursesWithHoles } from "./courses";
import { getAllSeasons } from "./seasons";

export interface RoundListItem extends Round {
  course_name: string;
  season_name: string;
  player_names: string[];
}

export async function getRounds(opts?: { limit?: number }): Promise<RoundListItem[]> {
  const supabase = await createClient();
  let query = supabase
    .from("rounds")
    .select(
      "*, courses(name), seasons(name, modality), round_players(player_id, players(full_name))"
    )
    .order("played_on", { ascending: false })
    .order("created_at", { ascending: false });
  if (opts?.limit) query = query.limit(opts.limit);

  const { data, error } = await query;
  if (error) throw error;

  type Row = Round & {
    courses: { name: string } | null;
    seasons: { name: string; modality: string } | null;
    round_players: { players: { full_name: string } | null }[];
  };

  return ((data as unknown as Row[]) ?? []).map((r) => ({
    id: r.id,
    course_id: r.course_id,
    season_id: r.season_id,
    played_on: r.played_on,
    notes: r.notes,
    team_a: r.team_a,
    team_b: r.team_b,
    created_by: r.created_by,
    created_at: r.created_at,
    course_name: r.courses?.name ?? "Campo desconocido",
    season_name: r.seasons?.name ?? "Temporada desconocida",
    player_names: r.round_players.map((rp) => rp.players?.full_name ?? "?"),
  }));
}

/** Carga una ronda concreta con toda su información (campo, temporada, jugadores, tarjeta). */
export async function getRoundFull(id: string): Promise<RoundFull | null> {
  const supabase = await createClient();
  const { data: round, error } = await supabase.from("rounds").select("*").eq("id", id).single();
  if (error || !round) return null;

  const [{ data: courseData }, { data: holes }, { data: seasonData }, { data: players }, { data: scores }] =
    await Promise.all([
      supabase.from("courses").select("*").eq("id", (round as Round).course_id).single(),
      supabase
        .from("course_holes")
        .select("*")
        .eq("course_id", (round as Round).course_id)
        .order("hole_number", { ascending: true }),
      supabase.from("seasons").select("*").eq("id", (round as Round).season_id).single(),
      supabase.from("round_players").select("*").eq("round_id", id),
      supabase.from("hole_scores").select("*").eq("round_id", id),
    ]);

  return {
    ...(round as Round),
    course: { ...(courseData as RoundFull["course"]), holes: (holes as CourseHole[]) ?? [] },
    season: seasonData as Season,
    players: (players as RoundPlayer[]) ?? [],
    scores: (scores as HoleScore[]) ?? [],
  };
}

/**
 * Carga todas las rondas completas (con tarjetas y temporada), para alimentar el
 * cálculo de clasificaciones. El filtrado por temporada/modalidad se hace en
 * memoria a partir de round.season, ya que cada ronda pertenece a una única
 * temporada.
 */
export async function getRoundsFull(): Promise<RoundFull[]> {
  const supabase = await createClient();

  const [{ data: rounds, error }, courses, seasons, { data: allPlayers }, { data: allScores }] =
    await Promise.all([
      supabase.from("rounds").select("*").order("played_on", { ascending: true }),
      getAllCoursesWithHoles(),
      getAllSeasons(),
      supabase.from("round_players").select("*"),
      supabase.from("hole_scores").select("*"),
    ]);
  if (error) throw error;

  const coursesById = new Map(courses.map((c) => [c.id, c]));
  const seasonsById = new Map(seasons.map((s) => [s.id, s]));
  const playersByRound = new Map<string, RoundPlayer[]>();
  for (const rp of (allPlayers as RoundPlayer[]) ?? []) {
    const list = playersByRound.get(rp.round_id) ?? [];
    list.push(rp);
    playersByRound.set(rp.round_id, list);
  }
  const scoresByRound = new Map<string, HoleScore[]>();
  for (const s of (allScores as HoleScore[]) ?? []) {
    const list = scoresByRound.get(s.round_id) ?? [];
    list.push(s);
    scoresByRound.set(s.round_id, list);
  }

  return ((rounds as Round[]) ?? [])
    .map((r) => {
      const course = coursesById.get(r.course_id);
      const season = seasonsById.get(r.season_id);
      if (!course || !season) return null;
      return {
        ...r,
        course,
        season,
        players: playersByRound.get(r.id) ?? [],
        scores: scoresByRound.get(r.id) ?? [],
      } satisfies RoundFull;
    })
    .filter((r): r is RoundFull => r !== null);
}
