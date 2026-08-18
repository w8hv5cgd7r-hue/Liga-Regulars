import { createClient } from "@/lib/supabase/server";
import type { Modality, Season } from "@/lib/types";

export async function getSeasons(modality: Modality): Promise<Season[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("seasons")
    .select("*")
    .eq("modality", modality)
    .order("start_date", { ascending: false });
  if (error) throw error;
  return (data as Season[]) ?? [];
}

export async function getAllSeasons(): Promise<Season[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("seasons")
    .select("*")
    .order("start_date", { ascending: false });
  if (error) throw error;
  return (data as Season[]) ?? [];
}

export async function getSeason(id: string): Promise<Season | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("seasons").select("*").eq("id", id).single();
  if (error) return null;
  return data as Season;
}

/** Temporada "actual" de una modalidad: la que contiene hoy, o si no hay, la más reciente. */
export function pickCurrentSeason(seasons: Season[]): Season | null {
  if (!seasons.length) return null;
  const today = new Date().toISOString().slice(0, 10);
  const ongoing = seasons.find((s) => s.start_date <= today && s.end_date >= today);
  return ongoing ?? seasons[0];
}
