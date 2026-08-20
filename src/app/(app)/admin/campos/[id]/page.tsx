import { notFound } from "next/navigation";
import { getCourseWithHoles } from "@/lib/data/courses";
import { CourseForm } from "@/components/admin/CourseForm";

export default async function EditCoursePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const course = await getCourseWithHoles(id);
  if (!course) notFound();

  return (
    <div className="max-w-2xl">
      <h2 className="mb-4 font-semibold">Editar campo: {course.name}</h2>
      <CourseForm course={course} />
    </div>
  );
}
