"use client";

import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart,
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

export function PriceChart({ data }: { data: { date: string; price: number }[] }) {
  const summary = `40-week mock price history, ending at ${data.at(-1)?.price.toFixed(2)}`;
  return <div className="h-[330px] w-full" role="img" aria-label={summary}><ResponsiveContainer width="100%" height="100%"><AreaChart data={data} margin={{ top: 20, right: 14, bottom: 0, left: 4 }}><defs><linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={palette.accent} stopOpacity={0.16}/><stop offset="100%" stopColor={palette.accent} stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke={palette.line} vertical={false}/><XAxis dataKey="date" tick={{ fill: palette.muted, fontSize: 11 }} axisLine={false} tickLine={false}/><YAxis domain={["dataMin - 8", "dataMax + 5"]} orientation="right" tick={{ fill: palette.muted, fontSize: 11 }} axisLine={false} tickLine={false}/><Tooltip contentStyle={tooltipStyle}/><Area type="monotone" dataKey="price" stroke={palette.accent} fill="url(#priceFill)" strokeWidth={2}/></AreaChart></ResponsiveContainer></div>;
}

export function FinancialChart({ data }: { data: { year: string; revenue: number; income: number }[] }) {
  const latest = data.at(-1);
  return <div className="h-52 w-full" role="img" aria-label={`Mock financial trend; latest revenue ${latest?.revenue} billion and income ${latest?.income} billion`}><ResponsiveContainer width="100%" height="100%"><BarChart data={data}><CartesianGrid stroke={palette.line} vertical={false}/><XAxis dataKey="year" tick={{ fill: palette.muted, fontSize: 11 }} axisLine={false}/><YAxis tick={{ fill: palette.muted, fontSize: 11 }} axisLine={false}/><Tooltip contentStyle={tooltipStyle}/><Bar dataKey="revenue" fill={palette.accent}/><Bar dataKey="income">{data.map((_, i) => <Cell key={i} fill={palette.positive}/>)}</Bar></BarChart></ResponsiveContainer></div>;
}
