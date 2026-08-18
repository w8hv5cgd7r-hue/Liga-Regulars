"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteSeasonAction } from "@/lib/actions/admin-actions";

export function DeleteSeasonButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm(`¿Borrar la temporada "${name}"?`)) return;
        startTransition(async () => {
          const result = await deleteSeasonAction(id);
          if (!result.ok) alert(result.error);
          router.refresh();
        });
      }}
      className="text-xs font-medium text-danger underline disabled:opacity-60"
    >
      {pending ? "Borrando…" : "Borrar"}
    </button>
  );
}
