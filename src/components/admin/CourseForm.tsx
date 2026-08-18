"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { saveCourseAction, type ActionResult } from "@/lib/actions/admin-actions";
import type { CourseWithHoles } from "@/lib/types";

const initialState: ActionResult = { ok: true };

export function CourseForm({ course }: { course?: CourseWithHoles }) {
  const router = useRouter();
  const [numHoles, setNumHoles] = useState<9 | 18>(course && course.holes.length === 9 ? 9 : 18);
  const [holes, setHoles] = useState(() => buildInitialHoles(numHoles, course));

  const [state, formAction, pending] = useActionState(async (_prev: ActionResult, formData: FormData) => {
    const result = await saveCourseAction(formData);
    if (result.ok) router.push("/admin/campos");
    return result;
  }, initialState);

  function changeNumHoles(n: 9 | 18) {
    setNumHoles(n);
    setHoles(buildInitialHoles(n, undefined));
  }

  function autoFillStrokeIndex() {
    setHoles((prev) => prev.map((h, i) => ({ ...h, si: i + 1 })));
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {course && <input type="hidden" name="id" value={course.id} />}
      <input type="hidden" name="num_holes" value={numHoles} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="name">
            Nombre del campo
          </label>
          <input
            id="name"
            name="name"
            required
            defaultValue={course?.name}
            className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="location">
            Ubicación (opcional)
          </label>
          <input
            id="location"
            name="location"
            defaultValue={course?.location ?? ""}
            className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
          />
        </div>
      </div>

      {!course && (
        <div>
          <span className="mb-1 block text-sm font-medium">Número de hoyos</span>
          <div className="flex gap-2">
            {([9, 18] as const).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => changeNumHoles(n)}
                className={`rounded-md border px-3 py-1.5 text-sm ${
                  numHoles === n
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card"
                }`}
              >
                {n} hoyos
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium">
            Par e índice de hoyo (dificultad, 1 = más difícil, {numHoles} = más fácil)
          </span>
          <button
            type="button"
            onClick={autoFillStrokeIndex}
            className="text-xs font-medium text-primary underline"
          >
            Rellenar índice 1…{numHoles} en orden
          </button>
        </div>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[420px] text-sm">
            <thead className="bg-card text-left text-xs text-muted">
              <tr>
                <th className="px-2 py-2">Hoyo</th>
                <th className="px-2 py-2">Par</th>
                <th className="px-2 py-2">Índice (SI)</th>
              </tr>
            </thead>
            <tbody>
              {holes.map((h, idx) => (
                <tr key={h.hole} className="border-t border-border">
                  <td className="px-2 py-1.5 font-medium">{h.hole}</td>
                  <td className="px-2 py-1.5">
                    <input
                      type="number"
                      name={`hole_${h.hole}_par`}
                      min={3}
                      max={6}
                      value={h.par}
                      onChange={(e) =>
                        setHoles((prev) =>
                          prev.map((x, i) => (i === idx ? { ...x, par: Number(e.target.value) } : x))
                        )
                      }
                      className="w-16 rounded-md border border-border px-2 py-1"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="number"
                      name={`hole_${h.hole}_si`}
                      min={1}
                      max={numHoles}
                      value={h.si}
                      onChange={(e) =>
                        setHoles((prev) =>
                          prev.map((x, i) => (i === idx ? { ...x, si: Number(e.target.value) } : x))
                        )
                      }
                      className="w-16 rounded-md border border-border px-2 py-1"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-1 text-xs text-muted">
          Par total: {holes.reduce((s, h) => s + (h.par || 0), 0)}
        </p>
      </div>

      {!state.ok && state.error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-primary px-4 py-2.5 font-medium text-primary-foreground hover:bg-primary-dark disabled:opacity-60"
      >
        {pending ? "Guardando…" : course ? "Guardar cambios" : "Crear campo"}
      </button>
    </form>
  );
}

function buildInitialHoles(n: 9 | 18, course?: CourseWithHoles) {
  return Array.from({ length: n }, (_, i) => {
    const existing = course?.holes.find((h) => h.hole_number === i + 1);
    return { hole: i + 1, par: existing?.par ?? 4, si: existing?.stroke_index ?? i + 1 };
  });
}
