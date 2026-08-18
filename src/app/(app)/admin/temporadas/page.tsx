import { getAllSeasons } from "@/lib/data/seasons";
import { SeasonForm } from "@/components/admin/SeasonForm";
import { DeleteSeasonButton } from "@/components/admin/DeleteSeasonButton";
import { MODALITY_LABEL, type Modality } from "@/lib/types";
import { formatDateEs } from "@/lib/format";

export default async function AdminSeasonsPage() {
  const seasons = await getAllSeasons();
  const byModality = new Map<Modality, typeof seasons>();
  for (const s of seasons) {
    const list = byModality.get(s.modality) ?? [];
    list.push(s);
    byModality.set(s.modality, list);
  }

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h2 className="mb-2 font-semibold">Nueva temporada</h2>
        <p className="mb-3 text-sm text-muted">
          Cada modalidad tiene sus propias temporadas: puedes crear una de un mes, tres meses o lo
          que prefiráis. Las partidas jugadas dentro de esas fechas cuentan para la clasificación
          de esa temporada.
        </p>
        <SeasonForm />
      </section>

      {(Object.keys(MODALITY_LABEL) as Modality[]).map((modality) => (
        <section key={modality}>
          <h3 className="mb-2 font-semibold">{MODALITY_LABEL[modality]}</h3>
          <div className="flex flex-col gap-2">
            {(byModality.get(modality) ?? []).map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-lg border border-border bg-card p-3 text-sm"
              >
                <div>
                  <p className="font-medium">{s.name}</p>
                  <p className="text-xs text-muted">
                    {formatDateEs(s.start_date)} – {formatDateEs(s.end_date)}
                  </p>
                </div>
                <DeleteSeasonButton id={s.id} name={s.name} />
              </div>
            ))}
            {(byModality.get(modality) ?? []).length === 0 && (
              <p className="text-sm text-muted">Sin temporadas todavía en esta modalidad.</p>
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
