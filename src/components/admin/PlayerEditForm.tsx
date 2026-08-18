"use client";

import { useActionState } from "react";
import { updatePlayerAction, type ActionResult } from "@/lib/actions/admin-actions";
import type { Player } from "@/lib/types";

const initialState: ActionResult = { ok: true };

export function PlayerEditForm({ player, isSelf }: { player: Player; isSelf: boolean }) {
  const [state, formAction, pending] = useActionState(
    async (_prev: ActionResult, formData: FormData) => updatePlayerAction(formData),
    initialState
  );

  return (
    <form action={formAction} className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-card p-3 sm:grid-cols-6 sm:items-center">
      <input type="hidden" name="id" value={player.id} />

      <div className="col-span-2 sm:col-span-2">
        <label className="mb-1 block text-xs text-muted">Nombre</label>
        <input
          name="full_name"
          defaultValue={player.full_name}
          required
          className="w-full rounded-md border border-border px-2 py-1.5 text-sm"
        />
        <p className="mt-0.5 truncate text-xs text-muted">{player.email}</p>
      </div>

      <div>
        <label className="mb-1 block text-xs text-muted">Hándicap</label>
        <input
          name="handicap"
          type="number"
          step="0.1"
          min="0"
          max="54"
          defaultValue={player.handicap}
          required
          className="w-full rounded-md border border-border px-2 py-1.5 text-sm"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs text-muted">Rol</label>
        <select
          name="role"
          defaultValue={player.role}
          disabled={isSelf}
          className="w-full rounded-md border border-border px-2 py-1.5 text-sm disabled:opacity-60"
        >
          <option value="player">Jugador</option>
          <option value="admin">Admin</option>
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs text-muted">Estado</label>
        <select
          name="status"
          defaultValue={player.status}
          disabled={isSelf}
          className="w-full rounded-md border border-border px-2 py-1.5 text-sm disabled:opacity-60"
        >
          <option value="pending">Pendiente</option>
          <option value="active">Activo</option>
          <option value="inactive">Inactivo</option>
        </select>
      </div>

      <div className="flex items-end justify-end gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary-dark disabled:opacity-60"
        >
          {pending ? "Guardando…" : "Guardar"}
        </button>
      </div>

      {!state.ok && state.error && (
        <p role="alert" className="col-span-2 text-xs text-danger sm:col-span-6">
          {state.error}
        </p>
      )}
    </form>
  );
}
