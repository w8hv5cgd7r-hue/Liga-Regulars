"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteCourseAction } from "@/lib/actions/admin-actions";

export function DeleteCourseButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm(`¿Borrar el campo "${name}"? Esta acción no se puede deshacer.`)) return;
        startTransition(async () => {
          const result = await deleteCourseAction(id);
          if (!result.ok) alert(result.error);
          router.refresh();
        });
      }}
      className="text-sm font-medium text-danger underline disabled:opacity-60"
    >
      {pending ? "Borrando…" : "Borrar"}
    </button>
  );
}
