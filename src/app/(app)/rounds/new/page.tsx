import Link from "next/link";
import { getActivePlayers } from "@/lib/data/players";
import { getAllCoursesWithHoles } from "@/lib/data/courses";
import { getAllSeasons } from "@/lib/data/seasons";
import { RoundForm } from "@/components/rounds/RoundForm";

export default async function NewRoundPage() {
  const [players, courses, seasons] = await Promise.all([
    getActivePlayers(),
    getAllCoursesWithHoles(),
    getAllSeasons(),
  ]);

  if (courses.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-center">
        <p className="mb-2 font-medium">Todavía no hay ningún campo creado.</p>
        <p className="mb-4 text-sm text-muted">
          Un administrador tiene que añadir el campo (con el par y el índice de cada hoyo) antes
          de poder apuntar resultados.
        </p>
        <Link href="/admin/campos/nuevo" className="text-sm font-medium text-primary underline">
          Ir a crear un campo →
        </Link>
      </div>
    );
  }

  if (seasons.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-center">
        <p className="mb-2 font-medium">Todavía no hay ninguna temporada creada.</p>
        <p className="mb-4 text-sm text-muted">
          Cada partida cuenta para una temporada y modalidad concretas. Un administrador tiene
          que crear al menos una temporada antes de poder apuntar resultados.
        </p>
        <Link href="/admin/temporadas" className="text-sm font-medium text-primary underline">
          Ir a crear una temporada →
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold text-primary-dark">Apuntar resultado</h1>
      <RoundForm players={players} courses={courses} seasons={seasons} />
    </div>
  );
}
