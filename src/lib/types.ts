// Tipos compartidos que reflejan el esquema de supabase/schema.sql

export type AppRole = "admin" | "player";
export type PlayerStatus = "pending" | "active" | "inactive";
export type Modality = "stroke" | "stableford" | "match1v1" | "matchpairs";

export const MODALITY_LABEL: Record<Modality, string> = {
  stroke: "Individual - Golpes (Scratch/Neto)",
  stableford: "Individual - Stableford",
  match1v1: "Match Play 1 contra 1",
  matchpairs: "Match Play Parejas",
};

export const MODALITY_SHORT: Record<Modality, string> = {
  stroke: "Golpes",
  stableford: "Stableford",
  match1v1: "1 vs 1",
  matchpairs: "Parejas",
};

export interface Player {
  id: string;
  full_name: string;
  email: string;
  handicap: number;
  role: AppRole;
  status: PlayerStatus;
  avatar_color: string;
  created_at: string;
}

export interface Course {
  id: string;
  name: string;
  location: string | null;
  par: number;
  created_by: string | null;
  created_at: string;
}

export interface CourseHole {
  id: string;
  course_id: string;
  hole_number: number;
  par: number;
  stroke_index: number;
}

export interface CourseWithHoles extends Course {
  holes: CourseHole[];
}

export interface Season {
  id: string;
  modality: Modality;
  name: string;
  start_date: string;
  end_date: string;
  created_at: string;
}

/**
 * Una ronda (tarjeta de resultados) pertenece a UNA sola temporada, y por
 * tanto a UNA sola modalidad (la de esa temporada). No reparte resultados
 * entre varias modalidades. team_a/team_b solo se usan cuando la modalidad
 * de la temporada es match1v1 (1 jugador por equipo) o matchpairs (2 por
 * equipo); en golpes/stableford quedan a null.
 */
export interface Round {
  id: string;
  course_id: string;
  season_id: string;
  played_on: string;
  notes: string | null;
  team_a: string[] | null;
  team_b: string[] | null;
  /** Si es false, la partida se juega sin hándicap (scratch, como si fuera 0 para todos). */
  use_handicap: boolean;
  created_by: string | null;
  created_at: string;
}

export interface RoundPlayer {
  round_id: string;
  player_id: string;
  handicap: number;
}

export interface HoleScore {
  round_id: string;
  player_id: string;
  hole_number: number;
  strokes: number;
}

export interface RoundFull extends Round {
  course: CourseWithHoles;
  season: Season;
  players: RoundPlayer[];
  scores: HoleScore[];
}
