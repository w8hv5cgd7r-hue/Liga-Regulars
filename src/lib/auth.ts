import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Player } from "@/lib/types";

export async function getCurrentPlayer(): Promise<Player | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase.from("players").select("*").eq("id", user.id).single();
  return (data as Player) ?? null;
}

/** Exige sesión iniciada y jugador activo. Si no, redirige. */
export async function requireActivePlayer(): Promise<Player> {
  const player = await getCurrentPlayer();
  if (!player) redirect("/login");
  if (player.status === "pending") redirect("/pending");
  if (player.status === "inactive") redirect("/pending?inactive=1");
  return player;
}

/** Exige que el jugador activo sea administrador. */
export async function requireAdmin(): Promise<Player> {
  const player = await requireActivePlayer();
  if (player.role !== "admin") redirect("/");
  return player;
}
