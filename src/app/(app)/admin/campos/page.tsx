import Link from "next/link";
import { getAllCoursesWithHoles } from "@/lib/data/courses";
import { DeleteCourseButton } from "@/components/admin/DeleteCourseButton";

export default async function AdminCoursesPage() {
  const courses = await getAllCoursesWithHoles();

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/admin/campos/nuevo"
        className="self-start rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary-dark"
      >
        + Añadir campo
      </Link>

      <div className="flex flex-col gap-2">
        {courses.map((c) => (
          <div
            key={c.id}
            className="flex items-center justify-between rounded-lg border border-border bg-card p-3"
          >
            <div>
              <p className="font-medium">{c.name}</p>
              <p className="text-xs text-muted">
                {c.location ? `${c.location} · ` : ""}
                {c.holes.length} hoyos · par {c.par}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link href={`/admin/campos/${c.id}`} className="text-sm font-medium text-primary underline">
                Editar
              </Link>
              <DeleteCourseButton id={c.id} name={c.name} />
            </div>
          </div>
        ))}
        {courses.length === 0 && (
          <p className="text-sm text-muted">Todavía no hay campos. Añade el primero.</p>
        )}
      </div>
    </div>
  );
}
