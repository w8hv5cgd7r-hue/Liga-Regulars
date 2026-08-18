import { createClient } from "@/lib/supabase/server";
import type { Player } from "@/lib/types";

export async function getPlayers(): Promise<Player[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("players")
    .select("*")
    .order("full_name", { ascending: true });
  if (error) throw error;
  return (data as Player[]) ?? [];
}

export async function getActivePlayers(): Promise<Player[]> {
  const players = await getPlayers();
  return players.filter((p) => p.status === "active");
}

export async function getPlayer(id: string): Promise<Player | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("players").select("*").eq("id", id).single();
  if (error) return null;
  return data as Player;
}
