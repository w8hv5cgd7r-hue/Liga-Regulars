"use client";

// =========================================================================
// Escucha cambios en tiempo real (Supabase Realtime) en los golpes de una
// partida concreta y refresca la página cuando detecta alguno. Así, quien
// tenga abierta la partida en su móvil mientras otros juegan ve los
// resultados casi al instante, sin tener que refrescar a mano.
//
// No pinta nada (devuelve null): solo dispara `router.refresh()`, que
// vuelve a ejecutar el Server Component de la página con los datos nuevos.
// =========================================================================

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function LiveRoundWatcher({ roundId }: { roundId: string }) {
  const router = useRouter();
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createClient();

    function scheduleRefresh() {
      // Pequeño debounce: si llegan varios cambios seguidos (p. ej. al
      // guardar varios hoyos de golpe), solo se refresca una vez.
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => router.refresh(), 400);
    }

    const channel = supabase
      .channel(`round-${roundId}-live`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "hole_scores", filter: `round_id=eq.${roundId}` },
        scheduleRefresh
      )
      .subscribe();

    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      supabase.removeChannel(channel);
    };
  }, [roundId, router]);

  return null;
}
