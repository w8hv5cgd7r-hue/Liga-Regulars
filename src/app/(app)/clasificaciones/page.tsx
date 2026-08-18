import Link from "next/link";
import { getSeasons, pickCurrentSeason } from "@/lib/data/seasons";
import { getRoundsFull } from "@/lib/data/rounds";
import { getPlayers } from "@/lib/data/players";
import { computeStandingsForModality, withPlayerInfo } from "@/lib/scoring/standings";
import { StandingsTable } from "@/components/StandingsTable";
import { MODALITY_LABEL, MODALITY_SHORT, type Modality } from "@/lib/types";
import { formatDateEs } from "@/lib/format";

const MODALITIES: Modality[] = ["stroke", "stableford", "match1v1", "matchpairs"];

export default async function ClasificacionesPage({
  searchParams,
}: PageProps<"/clasificaciones">) {
  const params = await searchParams;
  const modality = (Array.isArray(params?.modality) ? params.modality[0] : params?.modality) as
    | Modality
    | undefined;
  const selectedModality: Modality = MODALITIES.includes(modality as Modality)
    ? (modality as Modality)
    : "stroke";

  const seasonParamRaw = Array.isArray(params?.temporada) ? params.temporada[0] : params?.temporada;

  const [seasons, players, allRounds] = await Promise.all([
    getSeasons(selectedModality),
    getPlayers(),
    getRoundsFull(),
  ]);
  const current = pickCurrentSeason(seasons);
  const seasonParam = seasonParamRaw ?? current?.id ?? "all";
  const selectedSeason = seasonParam === "all" ? null : seasons.find((s) => s.id === seasonParam);

  const modalityRounds = allRounds.filter((r) => r.season.modality === selectedModality);
  const scopedRounds = selectedSeason
    ? modalityRounds.filter((r) => r.season_id === selectedSeason.id)
    : modalityRounds;

  const standings = withPlayerInfo(computeStandingsForModality(scopedRounds, selectedModality), players);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-primary-dark">Clasificaciones</h1>

      <nav className="flex gap-1 overflow-x-auto border-b border-border" aria-label="Modalidad">
        {MODALITIES.map((m) => (
          <Link
            key={m}
            href={`/clasificaciones?modality=${m}`}
            className={`whitespace-nowrap rounded-t-md px-3 py-2 text-sm font-medium ${
              m === selectedModality
                ? "border-b-2 border-primary text-primary-dark"
                : "text-muted hover:bg-card"
            }`}
          >
            {MODALITY_SHORT[m]}
          </Link>
        ))}
      </nav>

      <p className="text-sm text-muted">{MODALITY_LABEL[selectedModality]}</p>

      <div className="flex flex-wrap gap-2">
        <Link
          href={`/clasificaciones?modality=${selectedModality}&temporada=all`}
          className={`rounded-full border px-3 py-1 text-xs font-medium ${
            seasonParam === "all"
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-card"
          }`}
        >
          General (todas las temporadas)
        </Link>
        {seasons.map((s) => (
          <Link
            key={s.id}
            href={`/clasificaciones?modality=${selectedModality}&temporada=${s.id}`}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              seasonParam === s.id
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card"
            }`}
          >
            {s.name}
          </Link>
        ))}
      </div>

      {selectedSeason && (
        <p className="text-xs text-muted">
          {formatDateEs(selectedSeason.start_date)} – {formatDateEs(selectedSeason.end_date)}
        </p>
      )}
      {seasons.length === 0 && (
        <p className="rounded-md bg-accent/10 px-3 py-2 text-xs text-accent">
          Todavía no hay ninguna temporada creada para esta modalidad. Un administrador puede
          crear una en Admin → Temporadas; hasta entonces no se pueden apuntar ni ver resultados
          de esta modalidad.
        </p>
      )}

      <StandingsTable rows={standings} modality={selectedModality} />

      <p className="text-xs text-muted">
        {selectedModality === "stroke" &&
          "Puntos por posición en cada partida (estilo orden de mérito): 10-7-5-3-2-1, y 1 punto de participación a partir de la 7ª posición."}
        {selectedModality === "stableford" &&
          "Puntos Stableford acumulados de todas las partidas contadas."}
        {(selectedModality === "match1v1" || selectedModality === "matchpairs") &&
          "3 puntos por partido ganado, 1 por empatado, 0 por perdido."}
      </p>
    </div>
  );
}
