"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteRoundAction } from "@/lib/actions/round-actions";

export function DeleteRoundButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm("¿Borrar esta partida y todos sus resultados?")) return;
        startTransition(async () => {
          const result = await deleteRoundAction(id);
          if (!result.ok) {
            alert(result.error);
            return;
          }
          router.push("/rounds");
        });
      }}
      className="text-sm font-medium text-danger underline disabled:opacity-60"
    >
      {pending ? "Borrando…" : "Borrar"}
    </button>
  );
}
