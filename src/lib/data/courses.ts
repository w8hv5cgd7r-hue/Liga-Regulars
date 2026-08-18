import { createClient } from "@/lib/supabase/server";
import type { Course, CourseHole, CourseWithHoles } from "@/lib/types";

export async function getCourses(): Promise<Course[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("courses")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw error;
  return (data as Course[]) ?? [];
}

export async function getCourseWithHoles(id: string): Promise<CourseWithHoles | null> {
  const supabase = await createClient();
  const [{ data: course, error: e1 }, { data: holes, error: e2 }] = await Promise.all([
    supabase.from("courses").select("*").eq("id", id).single(),
    supabase
      .from("course_holes")
      .select("*")
      .eq("course_id", id)
      .order("hole_number", { ascending: true }),
  ]);
  if (e1 || !course) return null;
  if (e2) throw e2;
  return { ...(course as Course), holes: (holes as CourseHole[]) ?? [] };
}

export async function getAllCoursesWithHoles(): Promise<CourseWithHoles[]> {
  const courses = await getCourses();
  const supabase = await createClient();
  const { data: holes, error } = await supabase
    .from("course_holes")
    .select("*")
    .order("hole_number", { ascending: true });
  if (error) throw error;
  const holesByCourse = new Map<string, CourseHole[]>();
  for (const h of (holes as CourseHole[]) ?? []) {
    const list = holesByCourse.get(h.course_id) ?? [];
    list.push(h);
    holesByCourse.set(h.course_id, list);
  }
  return courses.map((c) => ({ ...c, holes: holesByCourse.get(c.id) ?? [] }));
}
