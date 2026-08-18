"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatDateShortEs } from "@/lib/format";
import type { HandicapPoint, PlayerRoundStat } from "@/lib/scoring/playerStats";

const COLORS = { primary: "#1f6f4a", accent: "#c98a1f" };

export function HandicapChart({ stats }: { stats: HandicapPoint[] }) {
  const data = stats.map((s) => ({ date: formatDateShortEs(s.played_on), handicap: s.handicap }));
  if (data.length < 2) {
    return <EmptyChartHint text="Se necesitan al menos 2 partidas para ver la evolución." />;
  }
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#dfe6dd" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} width={36} />
        <Tooltip />
        <Line
          type="monotone"
          dataKey="handicap"
          stroke={COLORS.primary}
          strokeWidth={2}
          dot={{ r: 3 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function StablefordChart({ stats }: { stats: PlayerRoundStat[] }) {
  const data = stats.map((s) => ({ date: formatDateShortEs(s.played_on), points: s.stablefordPoints }));
  if (data.length < 2) {
    return <EmptyChartHint text="Se necesitan al menos 2 partidas para ver la evolución." />;
  }
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#dfe6dd" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} width={36} />
        <Tooltip />
        <Line
          type="monotone"
          dataKey="points"
          stroke={COLORS.accent}
          strokeWidth={2}
          dot={{ r: 3 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function EmptyChartHint({ text }: { text: string }) {
  return (
    <div className="flex h-[120px] items-center justify-center text-center text-xs text-muted">
      {text}
    </div>
  );
}
