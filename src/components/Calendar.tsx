"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { MONTH_NAMES, WEEKDAYS_SHORT, formatLongDate, monthGrid, parseIsoDate } from "@/lib/dates";
import { usePlatformFilter, useToday } from "@/lib/hooks";
import { PLATFORM_META } from "@/lib/platforms";
import { PLATFORMS, type Item, type Platform } from "@/lib/schema";
import { ItemDetail } from "./ItemDetail";

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

  return (
    <>
      <div className="flex items-end justify-between gap-4">
        <h1 className="font-display text-4xl leading-none whitespace-nowrap text-zinc-900 sm:text-6xl md:text-7xl">
          {MONTH_NAMES[month - 1]} <span className="text-zinc-300">{year}</span>
        </h1>
        <nav className="flex gap-2" aria-label="Month navigation">
          <MonthLink href={prevHref} label="Previous month">
            ←
          </MonthLink>
          <MonthLink href={nextHref} label="Next month">
            →
          </MonthLink>
        </nav>
      </div>

      <div className="mt-6 flex flex-wrap gap-2" role="toolbar" aria-label="Filter by platform">
        <FilterChip active={platform === null} onClick={() => setPlatform(null)}>
          All
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
          </FilterChip>
        ))}
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
              <div key={`pad-${i}`} aria-hidden />
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
          ? "border-zinc-900 bg-zinc-900 text-white"
          : `border-zinc-200 bg-white hover:border-zinc-400 ${muted ? "text-zinc-400" : "text-zinc-700"}`
      }`}
    >
      {children}
    </button>
  );
}

function DayNumber({ day, isToday, onImage }: { day: number; isToday: boolean; onImage?: boolean }) {
  const tone = isToday
    ? "bg-zinc-900 font-semibold text-white"
    : onImage
      ? "bg-white/90 font-medium text-zinc-900 shadow-sm"
      : "text-zinc-400";
  return <span className={`grid size-7 place-items-center rounded-full text-sm tabular-nums ${tone}`}>{day}</span>;
}

function PlatformDots({ items }: { items: Item[] }) {
  return (
    <span className="flex gap-1">
      {[...new Set(items.map((i) => i.platform))].map((p) => (
        <span
          key={p}
          title={PLATFORM_META[p].label}
          className={`size-2 rounded-full ring-2 ring-white ${PLATFORM_META[p].dot}`}
        />
      ))}
    </span>
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

  if (!top) {
    return (
      <div
        className={`flex aspect-[4/5] flex-col rounded-2xl p-2 ${
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
      className="group relative flex aspect-[4/5] flex-col overflow-hidden rounded-2xl bg-amber-50 p-2 text-left ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
    >
      {top.image ? (
        <>
          <Image
            src={top.image.src}
            alt=""
            fill
            unoptimized
            className="object-cover transition duration-300 group-hover:scale-105"
          />
          <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2.5 pt-10 text-[13px] font-medium leading-snug text-white opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
            <span className="line-clamp-3">{top.title}</span>
          </span>
        </>
      ) : (
        <span className="absolute inset-x-0 bottom-0 p-2.5 font-display text-lg leading-tight text-zinc-800">
          <span className="line-clamp-4">{top.title}</span>
        </span>
      )}
      <span className="relative flex items-center justify-between">
        <DayNumber day={day} isToday={isToday} onImage={Boolean(top.image)} />
        <span className="flex items-center gap-1.5">
          {items.length > 1 && (
            <span className="rounded-full bg-white/90 px-1.5 text-[11px] font-medium text-zinc-700 shadow-sm">
              +{items.length - 1}
            </span>
          )}
          <PlatformDots items={items} />
        </span>
      </span>
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
      <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-amber-50">
        {top.image && <Image src={top.image.src} alt="" fill unoptimized className="object-cover" />}
      </div>
      <p className="line-clamp-2 min-w-0 flex-1 text-sm font-medium text-zinc-900">{top.title}</p>
      {items.length > 1 && <span className="text-xs text-zinc-400">+{items.length - 1}</span>}
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
        <div className="flex-1 space-y-12 px-6 py-6">
          {ordered.map((item) => (
            <ItemDetail key={item.id} item={item} />
          ))}
        </div>
      </div>
    </div>
  );
}
