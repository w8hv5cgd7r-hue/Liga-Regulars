"use client";

import { useActionState } from "react";
import { createSeasonAction, type ActionResult } from "@/lib/actions/admin-actions";
import { MODALITY_LABEL, type Modality } from "@/lib/types";

const initialState: ActionResult = { ok: true };

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function monthsFromNowISO(months: number) {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

export function SeasonForm({ defaultModality }: { defaultModality?: Modality }) {
  const [state, formAction, pending] = useActionState(
    async (_prev: ActionResult, formData: FormData) => createSeasonAction(formData),
    initialState
  );

  return (
    <form action={formAction} className="grid grid-cols-1 gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-5 sm:items-end">
      <div>
        <label className="mb-1 block text-xs text-muted">Modalidad</label>
        <select
          name="modality"
          defaultValue={defaultModality ?? "stroke"}
          className="w-full rounded-md border border-border px-2 py-2 text-sm"
        >
          {Object.entries(MODALITY_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-2">
        <label className="mb-1 block text-xs text-muted">Nombre de la temporada</label>
        <input
          name="name"
          required
          placeholder="Ej: Verano 2026"
          className="w-full rounded-md border border-border px-2 py-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-muted">Inicio</label>
        <input
          name="start_date"
          type="date"
          required
          defaultValue={todayISO()}
          className="w-full rounded-md border border-border px-2 py-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-muted">Fin</label>
        <input
          name="end_date"
          type="date"
          required
          defaultValue={monthsFromNowISO(3)}
          className="w-full rounded-md border border-border px-2 py-2 text-sm"
        />
      </div>
      <div className="sm:col-span-5">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-dark disabled:opacity-60"
        >
          {pending ? "Creando…" : "Crear temporada"}
        </button>
        {!state.ok && state.error && <p className="mt-2 text-sm text-danger">{state.error}</p>}
      </div>
    </form>
  );
}
