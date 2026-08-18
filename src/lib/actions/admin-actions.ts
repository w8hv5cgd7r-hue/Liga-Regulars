"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { AppRole, Modality, PlayerStatus } from "@/lib/types";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

// ---------------------------------------------------------------- jugadores
export async function updatePlayerAction(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();

    const id = String(formData.get("id"));
  const full_name = String(formData.get("full_name") ?? "").trim();
  const handicap = Number(formData.get("handicap"));
  const roleRaw = formData.get("role");
  const statusRaw = formData.get("status");

  if (!id || !full_name || Number.isNaN(handicap)) {
    return { ok: false, error: "Datos de jugador incompletos." };
  }

  // Cuando editas tu propia fila, los campos de rol y estado están deshabilitados
  // en el formulario (para que no puedas quitarte el admin sin querer). Un campo
  // deshabilitado no se envía, así que en ese caso mantenemos el valor actual.
  const { data: current, error: currentError } = await supabase
    .from("players")
    .select("role, status")
    .eq("id", id)
    .single();
  if (currentError || !current) {
    return { ok: false, error: "No se encontró el jugador." };
  }

  const role = (roleRaw ? String(roleRaw) : current.role) as AppRole;
  const status = (statusRaw ? String(statusRaw) : current.status) as PlayerStatus;

  const { error } = await supabase
    .from("players")
    .update({ full_name, handicap, role, status })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/jugadores");
  revalidatePath("/jugadores");
  revalidatePath("/");
  return { ok: true };
}

// ------------------------------------------------------------------ campos
export async function saveCourseAction(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();

  const id = formData.get("id") ? String(formData.get("id")) : null;
  const name = String(formData.get("name") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  const numHoles = Number(formData.get("num_holes") ?? 18);

  if (!name || (numHoles !== 9 && numHoles !== 18)) {
    return { ok: false, error: "Nombre de campo u número de hoyos no válido." };
  }

  const holes: { hole_number: number; par: number; stroke_index: number }[] = [];
  const strokeIndexSeen = new Set<number>();
  for (let i = 1; i <= numHoles; i++) {
    const par = Number(formData.get(`hole_${i}_par`));
    const si = Number(formData.get(`hole_${i}_si`));
    if (!par || par < 3 || par > 6) return { ok: false, error: `Par no válido en el hoyo ${i}.` };
    if (!si || si < 1 || si > numHoles)
      return { ok: false, error: `Índice de hoyo no válido en el hoyo ${i} (debe ser 1-${numHoles}).` };
    if (strokeIndexSeen.has(si))
      return { ok: false, error: `El índice de hoyo ${si} está repetido. Cada hoyo debe tener uno distinto.` };
    strokeIndexSeen.add(si);
    holes.push({ hole_number: i, par, stroke_index: si });
  }
  const totalPar = holes.reduce((s, h) => s + h.par, 0);

  let courseId = id;
  if (id) {
    const { error } = await supabase
      .from("courses")
      .update({ name, location, par: totalPar })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
    await supabase.from("course_holes").delete().eq("course_id", id);
  } else {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("courses")
      .insert({ name, location, par: totalPar, created_by: user?.id })
      .select("id")
      .single();
    if (error || !data) return { ok: false, error: error?.message ?? "No se pudo crear el campo." };
    courseId = data.id;
  }

  const { error: holesError } = await supabase
    .from("course_holes")
    .insert(holes.map((h) => ({ ...h, course_id: courseId })));
  if (holesError) return { ok: false, error: holesError.message };

  revalidatePath("/admin/campos");
  revalidatePath("/rounds/new");
  return { ok: true };
}

export async function deleteCourseAction(id: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("courses").delete().eq("id", id);
  if (error) {
    return {
      ok: false,
      error: "No se pudo borrar: seguramente hay partidas registradas en este campo.",
    };
  }
  revalidatePath("/admin/campos");
  return { ok: true };
}

// --------------------------------------------------------------- temporadas
export async function createSeasonAction(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();

  const modality = String(formData.get("modality")) as Modality;
  const name = String(formData.get("name") ?? "").trim();
  const start_date = String(formData.get("start_date"));
  const end_date = String(formData.get("end_date"));

  if (!name || !start_date || !end_date) return { ok: false, error: "Rellena todos los campos." };
  if (end_date < start_date)
    return { ok: false, error: "La fecha de fin no puede ser anterior a la de inicio." };

  const { error } = await supabase
    .from("seasons")
    .insert({ modality, name, start_date, end_date });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/temporadas");
  revalidatePath("/clasificaciones");
  return { ok: true };
}

export async function deleteSeasonAction(id: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("seasons").delete().eq("id", id);
  if (error) {
    return {
      ok: false,
      error: "No se pudo borrar: hay partidas registradas en esta temporada.",
    };
  }
  revalidatePath("/admin/temporadas");
  revalidatePath("/clasificaciones");
  return { ok: true };
}
