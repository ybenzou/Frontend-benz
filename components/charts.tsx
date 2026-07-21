"use client";

import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

const palette = {
  surface: "#121920",
  line: "#222c35",
  muted: "#78858e",
  accent: "#6daeb8",
  positive: "#56b894",
  negative: "#e48877",
};
const tooltipStyle = { background: palette.surface, border: `1px solid ${palette.line}`, borderRadius: 4, fontSize: 13 };

export function Sparkline({ data, positive = true }: { data: number[]; positive?: boolean }) {
  const summary = `Price trend from ${data[0]?.toFixed(2)} to ${data.at(-1)?.toFixed(2)}`;
  return <div className="ml-auto h-8 w-24" role="img" aria-label={summary}><ResponsiveContainer width="100%" height="100%"><LineChart data={data.map((value, i) => ({ i, value }))}><Line type="monotone" dataKey="value" stroke={positive ? palette.positive : palette.negative} dot={false} strokeWidth={1.5} /></LineChart></ResponsiveContainer></div>;
}

export function FinancialChart({ data }: { data: { year: string; revenue: number | null; income: number | null }[] }) {
  const latest = data.at(-1);
  return <div className="h-52 w-full" role="img" aria-label={`Annual financial trend; latest revenue ${latest?.revenue ?? "unavailable"} billion and income ${latest?.income ?? "unavailable"} billion`}><ResponsiveContainer width="100%" height="100%"><BarChart data={data}><CartesianGrid stroke={palette.line} vertical={false}/><XAxis dataKey="year" tick={{ fill: palette.muted, fontSize: 11 }} axisLine={false}/><YAxis tick={{ fill: palette.muted, fontSize: 11 }} axisLine={false}/><Tooltip contentStyle={tooltipStyle}/><Bar dataKey="revenue" fill={palette.accent}/><Bar dataKey="income">{data.map((_, i) => <Cell key={i} fill={palette.positive}/>)}</Bar></BarChart></ResponsiveContainer></div>;
}
