"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { MONTH_NAMES, WEEKDAYS_SHORT, formatLongDate, monthGrid, monthKey, parseIsoDate } from "@/lib/dates";
import { usePlatformFilter, useToday } from "@/lib/hooks";
import { PLATFORM_META } from "@/lib/platforms";
import { PLATFORMS, type Item, type Platform } from "@/lib/schema";
import { CroppedImage } from "./CroppedImage";
import { ItemDetail } from "./ItemDetail";

type Props = {
  year: number;
  month: number;
  itemsByDate: Record<string, Item[]>;
  /** The archive's first day; earlier days are left blank rather than shown as missing. */
  firstDate: string | null;
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

export function Calendar({ year, month, itemsByDate, firstDate, prevHref, nextHref }: Props) {
  const today = useToday();
  const [platform, setPlatform] = usePlatformFilter();
  const [selected, setSelected] = useState<string | null>(null);

  const cells = useMemo(() => monthGrid(year, month), [year, month]);
  const monthPrefix = `${monthKey({ year, month })}-`;

  const visible = useMemo(() => {
    const out: Record<string, Item[]> = {};
    for (const [date, items] of Object.entries(itemsByDate)) {
      const filtered = platform ? items.filter((i) => i.platform === platform) : items;
      if (filtered.length > 0) out[date] = filtered;
    }
    return out;
  }, [itemsByDate, platform]);

  const shown = (date: string) =>
    date.startsWith(monthPrefix) && (Boolean(visible[date]) || !firstDate || date >= firstDate);

  const counts = useMemo(() => {
    const c = Object.fromEntries(PLATFORMS.map((p) => [p, 0])) as Record<Platform, number>;
    for (const items of Object.values(itemsByDate)) {
      for (const p of new Set(items.map((i) => i.platform))) c[p]++;
    }
    return c;
  }, [itemsByDate]);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-4xl leading-none whitespace-nowrap text-zinc-900 sm:text-6xl md:text-7xl">
          {MONTH_NAMES[month - 1]} <span className="text-zinc-300">{year}</span>
        </h1>
        <div className="flex items-center gap-2">
          <PlatformSelect value={platform} counts={counts} onChange={setPlatform} />
          <nav className="flex gap-2" aria-label="Month navigation">
            <MonthLink href={prevHref} label="Previous month">
              ←
            </MonthLink>
            <MonthLink href={nextHref} label="Next month">
              →
            </MonthLink>
          </nav>
        </div>
      </div>

      {/* Desktop: month grid */}
      <div className="mt-6 hidden md:block">
        <div className="grid grid-cols-7 gap-2 pb-2">
          {WEEKDAYS_SHORT.map((d) => (
            <div key={d} className="px-1 text-xs font-medium uppercase tracking-wider text-zinc-400">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-2">
          {cells.map((date) =>
            shown(date) ? (
              <DayCell
                key={date}
                date={date}
                items={visible[date] ?? []}
                state={dayState(date, Boolean(visible[date]), Boolean(itemsByDate[date]), today)}
                isToday={date === today}
                onOpen={() => setSelected(date)}
              />
            ) : (
              <div key={date} aria-hidden />
            ),
          )}
        </div>
      </div>

      {/* Mobile: agenda list */}
      <ol className="mt-6 space-y-2 md:hidden">
        {cells
          .filter(shown)
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

      {selected && itemsByDate[selected]?.[0] && (
        <DayDrawer date={selected} item={itemsByDate[selected][0]} onClose={() => setSelected(null)} />
      )}
    </>
  );
}

function MonthLink({ href, label, children }: { href: string | null; label: string; children: React.ReactNode }) {
  const className = "grid size-11 place-items-center rounded-full border text-lg transition-colors";
  if (!href) {
    return (
      <span aria-disabled className={`${className} cursor-not-allowed border-zinc-200 text-zinc-300`} title={label}>
        {children}
      </span>
    );
  }
  return (
    <Link href={href} aria-label={label} className={`${className} border-zinc-300 text-zinc-700 hover:bg-white`}>
      {children}
    </Link>
  );
}

function PlatformSelect({
  value,
  counts,
  onChange,
}: {
  value: Platform | null;
  counts: Record<Platform, number>;
  onChange: (p: Platform | null) => void;
}) {
  return (
    <label className="relative">
      <span className="sr-only">Platform</span>
      <select
        value={value ?? ""}
        onChange={(e) => onChange((e.target.value || null) as Platform | null)}
        className="h-11 appearance-none rounded-full border border-zinc-300 bg-white pr-9 pl-4 text-sm text-zinc-700 hover:border-zinc-400 focus-visible:outline-2 focus-visible:outline-zinc-900"
      >
        <option value="">All platforms</option>
        {PLATFORMS.map((p) => (
          <option key={p} value={p} disabled={counts[p] === 0}>
            {PLATFORM_META[p].label}
            {counts[p] === 0 ? " (soon)" : ""}
          </option>
        ))}
      </select>
      <span aria-hidden className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-xs text-zinc-400">
        ▾
      </span>
    </label>
  );
}

function DayNumber({ day, isToday, onImage }: { day: number; isToday: boolean; onImage?: boolean }) {
  const tone = isToday
    ? "bg-zinc-900 font-semibold text-white"
    : onImage
      ? "bg-white/90 font-medium text-zinc-900 shadow-sm"
      : "font-medium text-zinc-400";
  return (
    <span className={`grid size-6 shrink-0 place-items-center rounded-full text-xs tabular-nums ${tone}`}>{day}</span>
  );
}

const CELL_ASPECT = 3 / 4;

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

  if (!top) {
    return (
      <div
        className={`flex aspect-[3/4] flex-col rounded-2xl p-2 ${
          state === "future" ? "border border-dashed border-zinc-200" : "bg-zinc-200/40"
        }`}
      >
        <DayNumber day={day} isToday={isToday} />
        {state === "today" && <span className="m-auto size-2 animate-pulse rounded-full bg-amber-500" />}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${formatLongDate(date)}: ${top.title}`}
      className="group relative aspect-[3/4] overflow-hidden rounded-2xl bg-zinc-200 text-left ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
    >
      {top.image ? (
        <CroppedImage image={top.image} aspect={CELL_ASPECT} className="absolute inset-0" />
      ) : (
        <span className="absolute inset-x-0 bottom-0 line-clamp-5 p-2.5 font-display text-lg leading-tight text-zinc-800">
          {top.title}
        </span>
      )}
      <span className="absolute top-2 left-2">
        <DayNumber day={day} isToday={isToday} onImage={Boolean(top.image)} />
      </span>
      {top.image && (
        <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/50 to-transparent p-2.5 pt-12 opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
          {top.post && (
            <span className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-white/90">
              {top.post.avatar && (
                <Image src={top.post.avatar} alt="" width={16} height={16} unoptimized className="size-4 rounded-full" />
              )}
              <span className="truncate">{top.post.name}</span>
            </span>
          )}
          <span className="line-clamp-3 text-[13px] leading-snug font-medium text-white">{top.title}</span>
        </span>
      )}
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
  const dateLabel = (
    <div className="w-9 shrink-0 text-center">
      <div className="text-[11px] uppercase text-zinc-400">{weekday}</div>
      <div className={`text-xl tabular-nums ${state === "today" ? "font-semibold text-amber-600" : "text-zinc-900"}`}>
        {day}
      </div>
    </div>
  );

  if (!top) {
    return <div className="flex items-center gap-3 rounded-2xl p-2 opacity-50">{dateLabel}</div>;
  }
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-2xl bg-white p-2 text-left ring-1 ring-black/5"
    >
      {dateLabel}
      {top.image ? (
        <CroppedImage image={top.image} aspect={1} className="size-16 shrink-0 rounded-xl" />
      ) : (
        <div className="size-16 shrink-0 rounded-xl bg-zinc-100" />
      )}
      <p className="line-clamp-2 min-w-0 flex-1 text-sm font-medium text-zinc-900">{top.title}</p>
    </button>
  );
}

function DayDrawer({ date, item, onClose }: { date: string; item: Item; onClose: () => void }) {
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

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={formatLongDate(date)}>
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-zinc-900/30 backdrop-blur-sm" />
      <div className="relative flex h-full w-full max-w-xl flex-col overflow-y-auto bg-white shadow-2xl">
        <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-zinc-100 bg-white/90 px-6 py-4 backdrop-blur">
          <Link href={`/day/${date}`} className="font-display text-2xl text-zinc-900 hover:underline">
            {formatLongDate(date)}
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="grid size-9 shrink-0 place-items-center rounded-full border border-zinc-200 text-zinc-500 hover:bg-zinc-50"
            aria-label="Close"
          >
            ✕
          </button>
        </header>
        <div className="flex-1 px-6 py-6">
          <ItemDetail item={item} date={date} />
        </div>
      </div>
    </div>
  );
}
