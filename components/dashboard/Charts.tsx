"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import type { CardioTrendPoint, StrengthProgressPoint } from "@/lib/analytics";
import { formatLocalShortDate } from "@/lib/time";

const axisStyle = {
  fill: "#64748b",
  fontSize: 12
};

export function StrengthProgressChart({ points }: { points: StrengthProgressPoint[] }) {
  const data = points.map((point) => ({
    date: formatLocalShortDate(point.date),
    weight: point.weight,
    reps: point.reps,
    estimatedOneRepMax: point.estimatedOneRepMax
  }));

  if (data.length === 0) {
    return <div className="empty">No strength sets logged for this exercise yet.</div>;
  }

  return (
    <div className="chart">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ left: 0, right: 12, top: 10, bottom: 0 }}>
          <CartesianGrid stroke="#e2e8f0" vertical={false} />
          <XAxis dataKey="date" tick={axisStyle} tickLine={false} axisLine={false} />
          <YAxis tick={axisStyle} tickLine={false} axisLine={false} />
          <Tooltip />
          <Line
            type="monotone"
            dataKey="weight"
            name="Weight"
            stroke="#111827"
            strokeWidth={2}
            dot={false}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="reps"
            name="Reps"
            stroke="#64748b"
            strokeWidth={2}
            dot={false}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="estimatedOneRepMax"
            name="Estimated 1RM"
            stroke="#2563eb"
            strokeWidth={2}
            dot={false}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CardioTrendChart({ points }: { points: CardioTrendPoint[] }) {
  const data = points.map((point) => ({
    date: formatLocalShortDate(point.date),
    durationMinutes: point.durationMinutes,
    avgHeartRate: point.avgHeartRate,
    maxHeartRate: point.maxHeartRate,
    calories: point.calories
  }));

  if (data.length === 0) {
    return <div className="empty">No cardio activity sessions logged yet.</div>;
  }

  return (
    <div className="chart">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ left: 0, right: 12, top: 10, bottom: 0 }}>
          <CartesianGrid stroke="#e2e8f0" vertical={false} />
          <XAxis dataKey="date" tick={axisStyle} tickLine={false} axisLine={false} />
          <YAxis tick={axisStyle} tickLine={false} axisLine={false} />
          <Tooltip />
          <Area
            type="monotone"
            dataKey="durationMinutes"
            name="Duration"
            stroke="#111827"
            fill="#e2e8f0"
            strokeWidth={2}
            connectNulls
          />
          <Area
            type="monotone"
            dataKey="avgHeartRate"
            name="Avg HR"
            stroke="#dc2626"
            fill="#fee2e2"
            strokeWidth={2}
            connectNulls
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ZoneMinutesChart({ points }: { points: CardioTrendPoint[] }) {
  const latestWithZones = [...points]
    .reverse()
    .find((point) => point.zoneMinutes.some((minutes) => minutes > 0));

  if (!latestWithZones) {
    return <div className="empty">No heart rate zone minutes logged yet.</div>;
  }

  const data = latestWithZones.zoneMinutes.map((minutes, index) => ({
    zone: `Z${index}`,
    minutes
  }));

  return (
    <div className="chart">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ left: 0, right: 12, top: 10, bottom: 0 }}>
          <CartesianGrid stroke="#e2e8f0" vertical={false} />
          <XAxis dataKey="zone" tick={axisStyle} tickLine={false} axisLine={false} />
          <YAxis tick={axisStyle} tickLine={false} axisLine={false} />
          <Tooltip />
          <Bar dataKey="minutes" name="Minutes" fill="#111827" radius={[10, 10, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
