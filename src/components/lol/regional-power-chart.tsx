import { useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";
import type { CareerLedger, GameId } from "@/lib/lol/types";
import { Globe, TrendingUp } from "lucide-react";

interface RegionalPowerChartProps {
  career: CareerLedger;
  game: GameId;
}

const REGION_COLORS: Record<string, string> = {
  LCK: "#3b82f6", // Blue
  LPL: "#ef4444", // Red
  LEC: "#10b981", // Emerald
  LCS: "#06b6d4", // Cyan
  CBLOL: "#eab308", // Yellow / Gold
  LCP: "#a855f7", // Purple
  EU: "#3b82f6",
  NA: "#ef4444",
  SA: "#10b981",
};

export function RegionalPowerChart({ career, game }: RegionalPowerChartProps) {
  const chartData = useMemo(() => {
    const intlHistory = career.intlHistory?.[game] ?? [];
    if (intlHistory.length > 0) {
      const slice = intlHistory.slice(-6);
      const regSet = new Set<string>();
      for (const ed of slice) {
        for (const r of Object.keys(ed.regionScores ?? {})) regSet.add(r);
      }
      const regions = Array.from(regSet);
      return slice.map((ed) => {
        const row: Record<string, string | number> = {
          name: `${ed.champName.replace(/\s*\(.*?\)\s*/g, "").trim()} ${ed.season}`.trim(),
        };
        for (const reg of regions) {
          row[reg] = ed.regionScores?.[reg]?.coefPoints ?? 0;
        }
        return row;
      });
    }

    const gameData = career[game] ?? {};
    const teams = Object.values(gameData);

    // Fallback inicial antes de haver edições internacionais registradas
    const regionalStats: Record<string, { totalRating: number; count: number; points: number }> = {};

    for (const t of teams) {
      const reg = (t.region || "OUTROS").toUpperCase();
      if (!regionalStats[reg]) {
        regionalStats[reg] = { totalRating: 0, count: 0, points: 0 };
      }
      regionalStats[reg].totalRating += t.rating ?? 50;
      regionalStats[reg].points += t.points ?? 0;
      regionalStats[reg].count += 1;
    }

    const regions = Object.keys(regionalStats).filter((r) => regionalStats[r].count >= 1);
    const topRegions = regions
      .sort((a, b) => regionalStats[b].points - regionalStats[a].points)
      .slice(0, 6);

    const pointsTimeline = ["Temporada 1", "Temporada 2", "Temporada 3", "Split Passado", "Split Atual"];

    return pointsTimeline.map((timeLabel, idx) => {
      const factor = (idx + 1) / pointsTimeline.length;
      const row: Record<string, any> = { name: timeLabel };

      for (const reg of topRegions) {
        const base = regionalStats[reg];
        const calculatedPoints = Math.round(base.points * (0.35 + factor * 0.65) + (base.totalRating / base.count) * 0.5);
        row[reg] = calculatedPoints;
      }

      return row;
    });
  }, [career, game]);

  const activeRegions = useMemo(() => {
    if (chartData.length === 0) return [];
    return Object.keys(chartData[0]).filter((k) => k !== "name");
  }, [chartData]);

  return (
    <div className="rounded-2xl border border-border bg-[#0d0f14] p-6 shadow-xl text-foreground">
      <div className="flex items-center justify-between border-b border-border/60 pb-4 mb-6">
        <div className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-gold" />
          <div>
            <h3 className="font-display text-lg font-bold uppercase tracking-wider text-foreground">
              Evolução do Coeficiente e Força Regional
            </h3>
            <p className="text-xs text-muted-foreground">
              Histórico de pontuação e dominância das regiões competitivas de {game.toUpperCase()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 rounded-lg border border-gold/40 bg-gold/10 px-3 py-1 text-xs font-bold text-gold">
          <TrendingUp className="h-3.5 w-3.5" /> Força Dinâmica
        </div>
      </div>

      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#262833" vertical={false} />
            <XAxis
              dataKey="name"
              stroke="#6b7280"
              fontSize={12}
              tickLine={false}
              axisLine={{ stroke: "#374151" }}
            />
            <YAxis
              stroke="#6b7280"
              fontSize={12}
              tickLine={false}
              axisLine={{ stroke: "#374151" }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#11131a",
                borderColor: "#374151",
                borderRadius: "0.5rem",
                fontSize: "12px",
                color: "#f3f4f6",
              }}
              itemStyle={{ padding: "2px 0" }}
            />
            <Legend wrapperStyle={{ paddingTop: "12px", fontSize: "12px" }} />
            {activeRegions.map((region) => (
              <Line
                key={region}
                type="monotone"
                dataKey={region}
                stroke={REGION_COLORS[region] || "#d4af37"}
                strokeWidth={2.5}
                dot={{ r: 4, strokeWidth: 1.5, fill: "#11131a" }}
                activeDot={{ r: 6 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
