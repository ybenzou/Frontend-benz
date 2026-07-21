"use client";

import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

const tooltipStyle = { background: "#10151d", border: "1px solid #26303c", fontSize: 12 };

export function Sparkline({ data, positive = true }: { data: number[]; positive?: boolean }) {
  const summary = `Price trend from ${data[0]?.toFixed(2)} to ${data.at(-1)?.toFixed(2)}`;
  return <div className="ml-auto h-8 w-24" role="img" aria-label={summary}><ResponsiveContainer width="100%" height="100%"><LineChart data={data.map((value, i) => ({ i, value }))}><Line type="monotone" dataKey="value" stroke={positive ? "#38c98b" : "#f26b6b"} dot={false} strokeWidth={1.5} /></LineChart></ResponsiveContainer></div>;
}

export function PriceChart({ data }: { data: { date: string; price: number }[] }) {
  const summary = `40-week mock price history, ending at ${data.at(-1)?.price.toFixed(2)}`;
  return <div className="h-[310px] w-full" role="img" aria-label={summary}><ResponsiveContainer width="100%" height="100%"><AreaChart data={data} margin={{ top: 20, right: 14, bottom: 0, left: 4 }}><defs><linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4e8cff" stopOpacity={0.22}/><stop offset="100%" stopColor="#4e8cff" stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="#202a35" vertical={false}/><XAxis dataKey="date" tick={{ fill: "#7d8998", fontSize: 10 }} axisLine={false} tickLine={false}/><YAxis domain={["dataMin - 8", "dataMax + 5"]} orientation="right" tick={{ fill: "#7d8998", fontSize: 10 }} axisLine={false} tickLine={false}/><Tooltip contentStyle={tooltipStyle}/><Area type="monotone" dataKey="price" stroke="#4e8cff" fill="url(#priceFill)" strokeWidth={2}/></AreaChart></ResponsiveContainer></div>;
}

export function FinancialChart({ data }: { data: { year: string; revenue: number; income: number }[] }) {
  const latest = data.at(-1);
  return <div className="h-52 w-full" role="img" aria-label={`Mock financial trend; latest revenue ${latest?.revenue} billion and income ${latest?.income} billion`}><ResponsiveContainer width="100%" height="100%"><BarChart data={data}><CartesianGrid stroke="#202a35" vertical={false}/><XAxis dataKey="year" tick={{ fill: "#7d8998", fontSize: 10 }} axisLine={false}/><YAxis tick={{ fill: "#7d8998", fontSize: 10 }} axisLine={false}/><Tooltip contentStyle={tooltipStyle}/><Bar dataKey="revenue" fill="#4e8cff"/><Bar dataKey="income">{data.map((_, i) => <Cell key={i} fill="#38c98b"/>)}</Bar></BarChart></ResponsiveContainer></div>;
}
