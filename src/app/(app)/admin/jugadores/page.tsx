import { getPlayers } from "@/lib/data/players";
import { requireAdmin } from "@/lib/auth";
import { PlayerEditForm } from "@/components/admin/PlayerEditForm";

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendiente",
  active: "Activo",
  inactive: "Inactivo",
};

export default async function AdminPlayersPage() {
  const admin = await requireAdmin();
  const players = await getPlayers();

  const pending = players.filter((p) => p.status === "pending");
  const others = players.filter((p) => p.status !== "pending");

  return (
    <div className="flex flex-col gap-6">
      {pending.length > 0 && (
        <section>
          <h2 className="mb-2 font-semibold text-accent">
            Pendientes de activación ({pending.length})
          </h2>
          <div className="flex flex-col gap-2">
            {pending.map((p) => (
              <PlayerEditForm key={p.id} player={p} isSelf={p.id === admin.id} />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-2 font-semibold">Todos los jugadores</h2>
        <div className="flex flex-col gap-2">
          {others.map((p) => (
            <PlayerEditForm key={p.id} player={p} isSelf={p.id === admin.id} />
          ))}
          {others.length === 0 && <p className="text-sm text-muted">Sin jugadores todavía.</p>}
        </div>
        <p className="mt-3 text-xs text-muted">
          Estados: {Object.values(STATUS_LABEL).join(" · ")}. Solo los jugadores
          &quot;Activo&quot; pueden entrar en la aplicación.
        </p>
      </section>
    </div>
  );
}
