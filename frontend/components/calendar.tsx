"use client";

import { useState } from "react";
import { SiX, SiInstagram, SiTiktok, SiReddit, SiYoutube } from "react-icons/si";
import type { Trend } from "@/lib/types";

const PLATFORMS = [
  { key: "x", label: "X", icon: SiX, enabled: true },
  { key: "instagram", label: "Instagram", icon: SiInstagram, enabled: false },
  { key: "tiktok", label: "TikTok", icon: SiTiktok, enabled: false },
  { key: "reddit", label: "Reddit", icon: SiReddit, enabled: false },
  { key: "youtube", label: "YouTube", icon: SiYoutube, enabled: false },
] as const;

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

export default function Calendar({ trends }: { trends: Trend[] }) {
  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [platform, setPlatform] = useState("x");
  const [selected, setSelected] = useState<Trend | null>(null);

  const byDate = new Map<string, Trend>();
  for (const t of trends) {
    if (t.platform === platform) byDate.set(t.date, t);
  }

  const year = cursor.getFullYear();
  const monthIdx = cursor.getMonth();
  const firstDayOfWeek = new Date(year, monthIdx, 1).getDay();
  const totalDays = daysInMonth(year, monthIdx);

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push(d);

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight">Capsule</h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            A daily archive of viral moments across the internet.
          </p>
        </div>
        <div className="flex gap-1.5 mt-1">
          {PLATFORMS.map((p) => {
            const Icon = p.icon;
            const isActive = p.enabled && platform === p.key;
            return (
              <button
                key={p.key}
                disabled={!p.enabled}
                onClick={() => p.enabled && setPlatform(p.key)}
                title={p.enabled ? p.label : `${p.label} (coming soon)`}
                aria-label={p.label}
                className={`w-9 h-9 rounded-md border flex items-center justify-center transition ${
                  isActive
                    ? "border-[var(--accent)] text-[var(--accent)] bg-[var(--card)]"
                    : p.enabled
                    ? "border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:border-[var(--accent)] cursor-pointer"
                    : "border-[var(--border)] text-[var(--muted)]/40 cursor-not-allowed"
                }`}
              >
                <Icon className="w-4 h-4" />
              </button>
            );
          })}
        </div>
      </header>

      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setCursor(new Date(year, monthIdx - 1, 1))}
          className="px-3 py-1 rounded border border-[var(--border)] hover:border-[var(--accent)] text-sm"
        >
          ←
        </button>
        <h2 className="text-lg font-medium">
          {MONTH_NAMES[monthIdx]} {year}
        </h2>
        <button
          onClick={() => setCursor(new Date(year, monthIdx + 1, 1))}
          className="px-3 py-1 rounded border border-[var(--border)] hover:border-[var(--accent)] text-sm"
        >
          →
        </button>
      </div>

      <div className="grid grid-cols-7 gap-2 text-xs text-[var(--muted)] mb-2">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="px-2 py-1">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-2">
        {cells.map((day, i) => {
          if (day === null) return <div key={i} />;
          const dateStr = `${year}-${String(monthIdx + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const trend = byDate.get(dateStr);
          const isToday =
            today.getFullYear() === year &&
            today.getMonth() === monthIdx &&
            today.getDate() === day;
          const hasImage = !!trend?.image_url;

          return (
            <button
              key={i}
              onClick={() => trend && setSelected(trend)}
              disabled={!trend}
              style={
                hasImage
                  ? {
                      backgroundImage: `url(${trend!.image_url})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }
                  : undefined
              }
              className={`aspect-square rounded-md border text-left transition relative overflow-hidden ${
                trend
                  ? "border-[var(--border)] bg-[var(--card)] hover:border-[var(--accent)] cursor-pointer"
                  : "border-[var(--border)]/40 cursor-default"
              } ${isToday ? "ring-1 ring-[var(--accent)]" : ""}`}
            >
              <div
                className={`absolute top-2 left-2 z-10 text-xs font-medium ${
                  hasImage
                    ? "px-1.5 py-0.5 rounded bg-white/90 text-[var(--foreground)]"
                    : "text-[var(--muted)]"
                }`}
              >
                {day}
              </div>

              {trend && !hasImage && (
                <div className="absolute top-8 left-3 right-3 text-sm line-clamp-4 leading-snug text-[var(--foreground)]/85">
                  {trend.title}
                </div>
              )}

              {trend && hasImage && (
                <div className="absolute inset-x-0 bottom-0 px-3 pt-8 pb-2 bg-gradient-to-t from-black/75 via-black/40 to-transparent">
                  <div className="text-xs text-white line-clamp-2 leading-snug">
                    {trend.title}
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {selected && (
        <div
          className="fixed inset-0 bg-[var(--backdrop)] flex items-center justify-center p-4 z-50"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-[var(--card)] border border-[var(--border)] rounded-lg max-w-xl w-full p-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {selected.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={selected.image_url}
                alt=""
                className="w-full h-64 object-cover rounded-md mb-4"
              />
            )}
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
                className="inline-block mt-4 text-sm underline text-[var(--muted)] hover:text-[var(--accent)]"
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
