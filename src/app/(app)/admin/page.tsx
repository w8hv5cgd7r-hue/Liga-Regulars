import Link from "next/link";
import { getPlayers } from "@/lib/data/players";
import { getCourses } from "@/lib/data/courses";
import { getAllSeasons } from "@/lib/data/seasons";

export default async function AdminOverviewPage() {
  const [players, courses, seasons] = await Promise.all([
    getPlayers(),
    getCourses(),
    getAllSeasons(),
  ]);
  const pending = players.filter((p) => p.status === "pending");

  return (
    <div className="flex flex-col gap-4">
      {pending.length > 0 && (
        <div className="rounded-lg border border-accent/40 bg-accent/10 p-4">
          <p className="font-medium text-accent">
            {pending.length} jugador{pending.length > 1 ? "es" : ""} esperando activación
          </p>
          <ul className="mt-1 text-sm text-foreground">
            {pending.map((p) => (
              <li key={p.id}>• {p.full_name} ({p.email})</li>
            ))}
          </ul>
          <Link href="/admin/jugadores" className="mt-2 inline-block text-sm font-medium text-primary underline">
            Ir a activar jugadores →
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Jugadores" value={players.length} href="/admin/jugadores" />
        <StatCard label="Campos" value={courses.length} href="/admin/campos" />
        <StatCard label="Temporadas" value={seasons.length} href="/admin/temporadas" />
      </div>
    </div>
  );
}

function StatCard({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link
      href={href}
      className="rounded-lg border border-border bg-card p-4 hover:border-primary"
    >
      <p className="text-3xl font-bold text-primary-dark">{value}</p>
      <p className="text-sm text-muted">{label}</p>
    </Link>
  );
}
