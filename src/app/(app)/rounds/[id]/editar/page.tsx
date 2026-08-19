import { notFound, redirect } from "next/navigation";
import { getRoundFull } from "@/lib/data/rounds";
import { getPlayers } from "@/lib/data/players";
import { getAllCoursesWithHoles } from "@/lib/data/courses";
import { getAllSeasons } from "@/lib/data/seasons";
import { requireActivePlayer } from "@/lib/auth";
import { RoundForm } from "@/components/rounds/RoundForm";

export default async function EditRoundPage({ params }: PageProps<"/rounds/[id]/editar">) {
  const { id } = await params;
  const me = await requireActivePlayer();
  const [round, players, courses, seasons] = await Promise.all([
    getRoundFull(id),
    getPlayers(),
    getAllCoursesWithHoles(),
    getAllSeasons(),
  ]);
  if (!round) notFound();

  const canEdit = me.role === "admin" || me.id === round.created_by;
  if (!canEdit) redirect(`/rounds/${id}`);

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold text-primary-dark">Editar partida</h1>
      <RoundForm players={players} courses={courses} seasons={seasons} initialRound={round} />
    </div>
  );
}
