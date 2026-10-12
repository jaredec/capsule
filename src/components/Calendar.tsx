"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { MONTH_NAMES, WEEKDAYS_SHORT, formatLongDate, monthGrid, parseIsoDate } from "@/lib/dates";
import { usePlatformFilter, useToday } from "@/lib/hooks";
import { PLATFORM_META } from "@/lib/platforms";
import { PLATFORMS, type Item, type Platform } from "@/lib/schema";
import { ItemDetail, PlatformBadge } from "./ItemDetail";

type Props = {
  year: number;
  month: number;
  itemsByDate: Record<string, Item[]>;
  prevHref: string | null;
  nextHref: string | null;
};

type DayState = "archived" | "filtered" | "today" | "future" | "missing" | "unknown";

function dayState(date: string, hasVisible: boolean, hasAny: boolean, today: string | null): DayState {
  if (hasVisible) return "archived";
  if (hasAny) return "filtered";
  if (!today) return "unknown";
  if (date === today) return "today";
  return date > today ? "future" : "missing";
}

const EMPTY_LABEL: Record<Exclude<DayState, "archived">, string> = {
  filtered: "No pick on this platform",
  today: "Collecting…",
  future: "",
  missing: "Not archived yet",
  unknown: "",
};

export function Calendar({ year, month, itemsByDate, prevHref, nextHref }: Props) {
  const today = useToday();
  const [platform, setPlatform] = usePlatformFilter();
  const [selected, setSelected] = useState<string | null>(null);

  const cells = useMemo(() => monthGrid(year, month), [year, month]);

  const visible = useMemo(() => {
    const out: Record<string, Item[]> = {};
    for (const [date, items] of Object.entries(itemsByDate)) {
      const filtered = platform ? items.filter((i) => i.platform === platform) : items;
      if (filtered.length > 0) out[date] = filtered;
    }
    return out;
  }, [itemsByDate, platform]);

  const counts = useMemo(() => {
    const c = Object.fromEntries(PLATFORMS.map((p) => [p, 0])) as Record<Platform, number>;
    for (const items of Object.values(itemsByDate)) {
      for (const p of new Set(items.map((i) => i.platform))) c[p]++;
    }
    return c;
  }, [itemsByDate]);

  const archivedDays = Object.keys(visible).length;

  return (
    <>
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-zinc-500">{year}</p>
          <h1 className="font-display text-6xl leading-none text-zinc-50 md:text-7xl">{MONTH_NAMES[month - 1]}</h1>
          <p className="mt-3 text-sm text-zinc-500">
            {archivedDays} {archivedDays === 1 ? "day" : "days"} archived
            {platform ? ` on ${PLATFORM_META[platform].label}` : ""}
          </p>
        </div>
        <nav className="flex gap-2" aria-label="Month navigation">
          <MonthLink href={prevHref} label="Previous month">
            ←
          </MonthLink>
          <MonthLink href={nextHref} label="Next month">
            →
          </MonthLink>
        </nav>
      </div>

      <div className="mt-8 flex flex-wrap gap-2" role="toolbar" aria-label="Filter by platform">
        <FilterChip active={platform === null} onClick={() => setPlatform(null)}>
          All platforms
        </FilterChip>
        {PLATFORMS.map((p) => (
          <FilterChip
            key={p}
            active={platform === p}
            onClick={() => setPlatform(platform === p ? null : p)}
            muted={counts[p] === 0}
          >
            <span className={`size-2 rounded-full ${PLATFORM_META[p].dot}`} />
            {PLATFORM_META[p].label}
            <span className="tabular-nums text-zinc-500">{counts[p]}</span>
          </FilterChip>
        ))}
      </div>

      {/* Desktop: month grid */}
      <div className="mt-6 hidden md:block">
        <div className="grid grid-cols-7 gap-2 pb-2">
          {WEEKDAYS_SHORT.map((d) => (
            <div key={d} className="px-2 text-xs font-medium uppercase tracking-wider text-zinc-600">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-2">
          {cells.map((date, i) =>
            date ? (
              <DayCell
                key={date}
                date={date}
                items={visible[date] ?? []}
                state={dayState(date, Boolean(visible[date]), Boolean(itemsByDate[date]), today)}
                isToday={date === today}
                onOpen={() => setSelected(date)}
              />
            ) : (
              <div key={`pad-${i}`} aria-hidden className="min-h-36" />
            ),
          )}
        </div>
      </div>

      {/* Mobile: agenda list */}
      <ol className="mt-6 space-y-2 md:hidden">
        {cells
          .filter((d): d is string => d !== null)
          .map((date) => {
            const items = visible[date] ?? [];
            const state = dayState(date, items.length > 0, Boolean(itemsByDate[date]), today);
            if (state === "future") return null;
            return (
              <li key={date}>
                <AgendaRow date={date} items={items} state={state} onOpen={() => setSelected(date)} />
              </li>
            );
          })}
      </ol>

      {selected && (
        <DayDrawer
          date={selected}
          items={itemsByDate[selected] ?? []}
          platform={platform}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}

function MonthLink({ href, label, children }: { href: string | null; label: string; children: React.ReactNode }) {
  const className =
    "grid size-11 place-items-center rounded-full border text-lg transition-colors";
  if (!href) {
    return (
      <span aria-disabled className={`${className} cursor-not-allowed border-white/5 text-zinc-700`} title={label}>
        {children}
      </span>
    );
  }
  return (
    <Link href={href} aria-label={label} className={`${className} border-white/15 text-zinc-200 hover:bg-white/10`}>
      {children}
    </Link>
  );
}

function FilterChip({
  active,
  muted,
  onClick,
  children,
}: {
  active: boolean;
  muted?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
        active
          ? "border-zinc-100 bg-zinc-100 text-zinc-900 [&_.tabular-nums]:text-zinc-500"
          : `border-white/10 hover:border-white/30 ${muted ? "text-zinc-600" : "text-zinc-300"}`
      }`}
    >
      {children}
    </button>
  );
}

function DayCell({
  date,
  items,
  state,
  isToday,
  onOpen,
}: {
  date: string;
  items: Item[];
  state: DayState;
  isToday: boolean;
  onOpen: () => void;
}) {
  const { day } = parseIsoDate(date);
  const top = items[0];

  const dayNumber = (
    <span
      className={`grid size-7 place-items-center rounded-full text-sm tabular-nums ${
        isToday ? "bg-amber-300 font-semibold text-zinc-900" : "text-zinc-400"
      }`}
    >
      {day}
    </span>
  );

  if (!top) {
    return (
      <div
        className={`flex min-h-36 flex-col rounded-2xl border p-2.5 ${
          state === "future"
            ? "border-white/[0.03] bg-[repeating-linear-gradient(135deg,transparent,transparent_6px,rgba(255,255,255,0.015)_6px,rgba(255,255,255,0.015)_12px)] opacity-60"
            : "border-white/5 bg-white/[0.015]"
        }`}
      >
        {dayNumber}
        {state !== "archived" && EMPTY_LABEL[state] && (
          <span className="mt-auto text-xs text-zinc-600">{EMPTY_LABEL[state]}</span>
        )}
      </div>
    );
  }

  const platforms = [...new Set(items.map((i) => i.platform))];

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex min-h-36 flex-col rounded-2xl border border-white/10 bg-white/[0.04] p-2.5 text-left transition hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/[0.07] focus-visible:outline-2 focus-visible:outline-amber-300"
    >
      <div className="flex items-center justify-between">
        {dayNumber}
        <span className="flex gap-1">
          {platforms.map((p) => (
            <span key={p} title={PLATFORM_META[p].label} className={`size-2 rounded-full ${PLATFORM_META[p].dot}`} />
          ))}
        </span>
      </div>
      <p className="mt-2 line-clamp-3 text-[13px] font-medium leading-snug text-zinc-100">{top.title}</p>
      <div className="mt-auto flex items-center gap-1.5 pt-2">
        <PlatformBadge platform={top.platform} />
        {top.tags.slice(0, 1).map((t) => (
          <span key={t} className="truncate text-[11px] text-zinc-500">
            #{t}
          </span>
        ))}
        {items.length > 1 && <span className="ml-auto text-[11px] text-zinc-500">+{items.length - 1}</span>}
      </div>
    </button>
  );
}

function AgendaRow({
  date,
  items,
  state,
  onOpen,
}: {
  date: string;
  items: Item[];
  state: DayState;
  onOpen: () => void;
}) {
  const { day } = parseIsoDate(date);
  const weekday = formatLongDate(date).split(",")[0].slice(0, 3);
  const top = items[0];
  const inner = (
    <>
      <div className="w-10 shrink-0 text-center">
        <div className="text-[11px] uppercase text-zinc-500">{weekday}</div>
        <div className={`text-xl tabular-nums ${state === "today" ? "text-amber-300" : "text-zinc-200"}`}>{day}</div>
      </div>
      {top ? (
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm font-medium text-zinc-100">{top.title}</p>
          <div className="mt-1.5 flex items-center gap-2">
            <PlatformBadge platform={top.platform} />
            {items.length > 1 && <span className="text-xs text-zinc-500">+{items.length - 1} more</span>}
          </div>
        </div>
      ) : (
        <p className="text-sm text-zinc-600">{state === "archived" ? "" : EMPTY_LABEL[state]}</p>
      )}
    </>
  );
  if (!top) {
    return <div className="flex items-center gap-4 rounded-2xl border border-white/5 p-3">{inner}</div>;
  }
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-left"
    >
      {inner}
    </button>
  );
}

function DayDrawer({
  date,
  items,
  platform,
  onClose,
}: {
  date: string;
  items: Item[];
  platform: Platform | null;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  const ordered = platform
    ? [...items.filter((i) => i.platform === platform), ...items.filter((i) => i.platform !== platform)]
    : items;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={formatLongDate(date)}>
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative flex h-full w-full max-w-xl flex-col overflow-y-auto border-l border-white/10 bg-zinc-950 shadow-2xl">
        <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-white/10 bg-zinc-950/90 px-6 py-4 backdrop-blur">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">What happened</p>
            <h2 className="font-display text-2xl text-zinc-50">{formatLongDate(date)}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-9 shrink-0 place-items-center rounded-full border border-white/15 text-zinc-300 hover:bg-white/10"
            aria-label="Close"
          >
            ✕
          </button>
        </header>
        <div className="flex-1 space-y-10 px-6 py-6">
          {ordered.map((item) => (
            <ItemDetail key={item.id} item={item} />
          ))}
        </div>
        <footer className="border-t border-white/10 px-6 py-4">
          <Link href={`/day/${date}`} className="text-sm text-zinc-300 underline underline-offset-4 hover:text-white">
            Open permalink for this day →
          </Link>
        </footer>
      </div>
    </div>
  );
}
