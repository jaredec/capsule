"use client";

import { useState } from "react";
import useSWR from "swr";
import type { Trend } from "@/lib/supabase";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const PLATFORMS = [
  { value: "x", label: "X" },
];

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

export default function Calendar() {
  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [platform] = useState("x");
  const [selected, setSelected] = useState<Trend | null>(null);

  const month = monthKey(cursor);
  const { data, isLoading } = useSWR<{ trends: Trend[] }>(
    `/api/trends?platform=${platform}&month=${month}`,
    fetcher,
  );
  const byDate = new Map<string, Trend>();
  for (const t of data?.trends ?? []) byDate.set(t.date, t);

  const year = cursor.getFullYear();
  const monthIdx = cursor.getMonth();
  const firstDayOfWeek = new Date(year, monthIdx, 1).getDay();
  const totalDays = daysInMonth(year, monthIdx);

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push(d);

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <header className="mb-8">
        <h1 className="text-4xl font-semibold tracking-tight">Capsule</h1>
        <p className="text-sm text-[var(--muted)] mt-1">
          A daily archive of viral moments across the internet.
        </p>
      </header>

      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setCursor(new Date(year, monthIdx - 1, 1))}
          className="px-3 py-1 rounded border border-[var(--border)] hover:bg-[var(--card)] text-sm"
        >
          ←
        </button>
        <h2 className="text-lg font-medium">
          {MONTH_NAMES[monthIdx]} {year}
        </h2>
        <button
          onClick={() => setCursor(new Date(year, monthIdx + 1, 1))}
          className="px-3 py-1 rounded border border-[var(--border)] hover:bg-[var(--card)] text-sm"
        >
          →
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-xs text-[var(--muted)] mb-2">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="px-2 py-1">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (day === null) return <div key={i} />;
          const dateStr = `${year}-${String(monthIdx + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const trend = byDate.get(dateStr);
          const isToday =
            today.getFullYear() === year &&
            today.getMonth() === monthIdx &&
            today.getDate() === day;
          return (
            <button
              key={i}
              onClick={() => trend && setSelected(trend)}
              disabled={!trend}
              className={`aspect-square rounded border text-left p-2 transition ${
                trend
                  ? "border-[var(--border)] bg-[var(--card)] hover:border-white cursor-pointer"
                  : "border-[var(--border)]/40 cursor-default"
              } ${isToday ? "ring-1 ring-white" : ""}`}
            >
              <div className="text-xs text-[var(--muted)]">{day}</div>
              {trend && (
                <div className="text-xs mt-1 line-clamp-2 leading-tight">
                  {trend.title}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {isLoading && <p className="text-xs text-[var(--muted)] mt-4">Loading…</p>}

      {selected && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-[var(--card)] border border-[var(--border)] rounded-lg max-w-lg w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-xs text-[var(--muted)] uppercase tracking-wide">
              {selected.platform} · {selected.date}
            </div>
            <h3 className="text-xl font-semibold mt-2">{selected.title}</h3>
            <p className="text-sm mt-3 text-[var(--foreground)]/90 whitespace-pre-wrap">
              {selected.description}
            </p>
            {selected.link && (
              <a
                href={selected.link}
                target="_blank"
                rel="noreferrer"
                className="inline-block mt-4 text-sm underline text-[var(--muted)] hover:text-white"
              >
                View source ↗
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
