"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronDown, ChevronLeft, ChevronRight, Play, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { mediaSrc } from "@/lib/basePath";
import {
  MONTH_NAMES,
  WEEKDAYS_SHORT,
  formatLongDate,
  formatShortDate,
  monthGrid,
  monthKey,
  parseIsoDate,
} from "@/lib/dates";
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
  /** The archive's last day; later days read as not archived yet. */
  lastDate: string | null;
  prevHref: string | null;
  nextHref: string | null;
};

type DayState = "archived" | "filtered" | "pending";

function dayState(date: string, visible: boolean, any: boolean, lastDate: string | null): DayState {
  if (visible) return "archived";
  if (any) return "filtered";
  return lastDate && date > lastDate ? "pending" : "filtered";
}

const DRAWER_MS = 320;

export function Calendar({ year, month, itemsByDate, firstDate, lastDate, prevHref, nextHref }: Props) {
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

  const counts = useMemo(() => {
    const c = Object.fromEntries(PLATFORMS.map((p) => [p, 0])) as Record<Platform, number>;
    for (const items of Object.values(itemsByDate)) {
      for (const p of new Set(items.map((i) => i.platform))) c[p]++;
    }
    return c;
  }, [itemsByDate]);
  const platformsWithData = PLATFORMS.filter((p) => counts[p] > 0).length;

  const inMonth = (date: string) => date.startsWith(monthPrefix);
  const shown = (date: string) => inMonth(date) && (Boolean(visible[date]) || !firstDate || date >= firstDate);
  const isPending = (date: string) => Boolean(lastDate && date > lastDate);

  // Weeks wholly past the archive's end collapse into one line instead of rows of empty cells.
  const weeks = useMemo(() => {
    const out: string[][] = [];
    for (let i = 0; i < cells.length; i += 7) out.push(cells.slice(i, i + 7));
    return out;
  }, [cells]);
  const isPendingWeek = (week: string[]) => week.filter(inMonth).every(isPending);
  const shownWeeks = weeks.filter((w) => !isPendingWeek(w));
  const pendingDays = cells.filter((d) => inMonth(d) && isPending(d));
  const pendingNote = pendingDays.length > 0 && lastDate ? `Nothing archived after ${formatShortDate(lastDate)} yet.` : null;

  const archivedDates = useMemo(() => Object.keys(visible).sort(), [visible]);
  const selectedIndex = selected ? archivedDates.indexOf(selected) : -1;

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <h1 className="min-w-0 font-display text-5xl leading-none whitespace-nowrap text-zinc-900 sm:text-6xl md:text-7xl">
          {MONTH_NAMES[month - 1]} <span className="text-zinc-300">{year}</span>
        </h1>
        <div className="flex shrink-0 items-center gap-2">
          {platformsWithData > 1 && <PlatformSelect value={platform} counts={counts} onChange={setPlatform} />}
          <nav className="flex gap-1.5" aria-label="Month navigation">
            <MonthLink href={prevHref} label="Previous month">
              <ChevronLeft className="size-5" />
            </MonthLink>
            <MonthLink href={nextHref} label="Next month">
              <ChevronRight className="size-5" />
            </MonthLink>
          </nav>
        </div>
      </div>
      <p className="mt-3 text-[15px] text-zinc-500">The post that took over the internet, one day at a time.</p>

      {/* Desktop: month grid */}
      <div className="mt-8 hidden md:block">
        <div className="grid grid-cols-7 gap-2 pb-2.5 lg:gap-2.5">
          {WEEKDAYS_SHORT.map((d) => (
            <div key={d} className="px-1 text-xs font-medium tracking-wider text-zinc-400 uppercase">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-2 lg:gap-2.5">
          {shownWeeks.flat().map((date) =>
            shown(date) ? (
              <DayCell
                key={date}
                date={date}
                items={visible[date] ?? []}
                state={dayState(date, Boolean(visible[date]), Boolean(itemsByDate[date]), lastDate)}
                isToday={date === today}
                onOpen={() => setSelected(date)}
              />
            ) : (
              <div key={date} aria-hidden />
            ),
          )}
          {pendingNote && shownWeeks.length < weeks.length && (
            <p className="col-span-7 rounded-2xl border border-dashed border-zinc-300/80 px-5 py-4 text-center text-sm text-zinc-500">
              {pendingNote}
            </p>
          )}
        </div>
      </div>

      {/* Mobile: agenda list */}
      <ol className="mt-6 space-y-2 md:hidden">
        {cells
          .filter((d) => shown(d) && !isPending(d))
          .map((date) => {
            const items = visible[date] ?? [];
            return (
              <li key={date}>
                <AgendaRow date={date} items={items} isToday={date === today} onOpen={() => setSelected(date)} />
              </li>
            );
          })}
        {pendingNote && (
          <li className="rounded-2xl border border-dashed border-zinc-300/80 px-4 py-3.5 text-center text-sm text-zinc-500">
            {pendingNote}
          </li>
        )}
      </ol>

      {selected && visible[selected]?.[0] && (
        <DayDrawer
          date={selected}
          item={visible[selected][0]}
          prev={archivedDates[selectedIndex - 1] ?? null}
          next={archivedDates[selectedIndex + 1] ?? null}
          onNavigate={setSelected}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}

const roundButton =
  "grid size-10 place-items-center rounded-full border transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900";

function MonthLink({ href, label, children }: { href: string | null; label: string; children: React.ReactNode }) {
  if (!href) {
    return (
      <span aria-disabled className={`${roundButton} cursor-not-allowed border-zinc-200 text-zinc-300`} title={label}>
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className={`${roundButton} border-zinc-300 bg-white/60 text-zinc-700 hover:border-zinc-400 hover:bg-white`}
    >
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
        className="h-10 appearance-none rounded-full border border-zinc-300 bg-white pr-9 pl-4 text-sm text-zinc-700 hover:border-zinc-400 focus-visible:outline-2 focus-visible:outline-zinc-900"
      >
        <option value="">All platforms</option>
        {PLATFORMS.map((p) => (
          <option key={p} value={p} disabled={counts[p] === 0}>
            {PLATFORM_META[p].label}
            {counts[p] === 0 ? " (soon)" : ""}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-zinc-400"
      />
    </label>
  );
}

function DayNumber({ day, isToday, onImage }: { day: number; isToday: boolean; onImage?: boolean }) {
  const tone = isToday
    ? "bg-zinc-900 font-semibold text-white"
    : onImage
      ? "bg-white/95 font-medium text-zinc-900 shadow-[0_1px_3px_rgb(0_0_0/0.2)]"
      : "font-medium text-zinc-400";
  return (
    <span
      className={`grid size-6 shrink-0 place-items-center rounded-full text-xs tabular-nums [text-box:trim-both_cap_alphabetic] ${tone}`}
    >
      {day}
    </span>
  );
}

function VideoBadge({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`grid size-6 place-items-center rounded-full bg-black/55 text-white backdrop-blur-sm ${className}`}
    >
      <Play className="ml-px size-3 fill-current" />
    </span>
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
          state === "pending" ? "border border-dashed border-zinc-300/80" : "bg-zinc-200/40"
        }`}
      >
        <DayNumber day={day} isToday={isToday} />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${formatLongDate(date)}: ${top.title}`}
      className="group relative aspect-[3/4] overflow-hidden rounded-2xl bg-zinc-200 text-left ring-1 ring-black/5 transition-[translate,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_12px_28px_-10px_rgb(0_0_0/0.35)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
    >
      {top.image ? (
        <CroppedImage
          image={top.image}
          aspect={CELL_ASPECT}
          className="absolute inset-0 transition-transform duration-500 ease-out group-hover:scale-[1.03]"
        />
      ) : (
        <span className="absolute inset-x-0 bottom-0 line-clamp-5 p-2.5 font-display text-lg leading-tight text-zinc-800">
          {top.title}
        </span>
      )}
      <span className="absolute top-2 left-2">
        <DayNumber day={day} isToday={isToday} onImage={Boolean(top.image)} />
      </span>
      {top.kind === "video" && <VideoBadge className="absolute top-2 right-2" />}
      {top.image && (
        <span className="absolute inset-x-0 bottom-0 translate-y-1 bg-gradient-to-t from-black/85 via-black/55 to-transparent p-3 pt-14 opacity-0 transition duration-200 ease-out group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100">
          {top.post && (
            <span className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-white/90">
              {top.post.avatar && (
                <Image
                  src={mediaSrc(top.post.avatar)}
                  alt=""
                  width={16}
                  height={16}
                  unoptimized
                  className="size-4 rounded-full"
                />
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
  isToday,
  onOpen,
}: {
  date: string;
  items: Item[];
  isToday: boolean;
  onOpen: () => void;
}) {
  const { day } = parseIsoDate(date);
  const weekday = formatLongDate(date).split(",")[0].slice(0, 3);
  const top = items[0];
  const dateLabel = (
    <div className="w-9 shrink-0 text-center">
      <div className="text-[11px] font-medium tracking-wide text-zinc-400 uppercase">{weekday}</div>
      <div className={`text-xl leading-7 tabular-nums ${isToday ? "font-semibold text-amber-600" : "text-zinc-900"}`}>
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
      aria-label={`${formatLongDate(date)}: ${top.title}`}
      className="flex w-full items-center gap-3 rounded-2xl bg-white p-2 pr-3 text-left ring-1 ring-black/[0.06] transition-colors active:bg-zinc-50"
    >
      {dateLabel}
      <span className="relative shrink-0">
        {top.image ? (
          <CroppedImage image={top.image} aspect={1} className="size-14 rounded-xl" />
        ) : (
          <span className="block size-14 rounded-xl bg-zinc-100" />
        )}
        {top.kind === "video" && <VideoBadge className="absolute right-1 bottom-1 size-5" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 text-[15px] leading-snug font-medium text-zinc-900">{top.title}</span>
        {top.post && <span className="mt-0.5 block truncate text-[13px] text-zinc-500">{top.post.handle}</span>}
      </span>
    </button>
  );
}

function DayDrawer({
  date,
  item,
  prev,
  next,
  onNavigate,
  onClose,
}: {
  date: string;
  item: Item;
  prev: string | null;
  next: string | null;
  onNavigate: (date: string) => void;
  onClose: () => void;
}) {
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const closing = useRef(false);

  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    setOpen(false);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.setTimeout(onClose, reduced ? 0 : DRAWER_MS);
  }, [onClose]);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const frame = requestAnimationFrame(() => setOpen(true));
    closeRef.current?.focus({ preventScroll: true });
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = overflow;
      opener?.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowLeft" && prev) onNavigate(prev);
      else if (e.key === "ArrowRight" && next) onNavigate(next);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close, prev, next, onNavigate]);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
  }, [date]);

  const iconButton =
    "grid size-9 shrink-0 place-items-center rounded-full text-zinc-600 transition-colors duration-150 hover:bg-zinc-100 hover:text-zinc-900 disabled:pointer-events-none disabled:text-zinc-300 focus-visible:outline-2 focus-visible:outline-zinc-900";

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={formatLongDate(date)}>
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        onClick={close}
        className={`absolute inset-0 bg-zinc-900/30 backdrop-blur-[2px] transition-opacity duration-300 ease-out motion-reduce:transition-none ${
          open ? "opacity-100" : "opacity-0"
        }`}
      />
      <div
        className={`relative flex h-full w-full max-w-[560px] flex-col bg-white shadow-2xl transition-transform duration-[320ms] ease-[cubic-bezier(0.3,0.75,0.1,1)] motion-reduce:transition-none ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <header className="flex items-center gap-2 border-b border-zinc-100 py-3 pr-3 pl-6">
          <Link
            href={`/day/${date}`}
            className="min-w-0 flex-1 truncate font-display text-[22px] leading-tight text-zinc-900 hover:underline hover:decoration-zinc-300 hover:underline-offset-4"
          >
            {formatLongDate(date).replace(/, \d{4}$/, "")}
          </Link>
          <button
            type="button"
            className={iconButton}
            disabled={!prev}
            onClick={() => prev && onNavigate(prev)}
            aria-label="Previous day"
            title="Previous day (←)"
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            type="button"
            className={iconButton}
            disabled={!next}
            onClick={() => next && onNavigate(next)}
            aria-label="Next day"
            title="Next day (→)"
          >
            <ChevronRight className="size-5" />
          </button>
          <span className="mx-1 h-5 w-px bg-zinc-200" aria-hidden />
          <button ref={closeRef} type="button" onClick={close} className={iconButton} aria-label="Close" title="Close (Esc)">
            <X className="size-5" />
          </button>
        </header>
        <div ref={bodyRef} className="flex-1 overflow-y-auto overscroll-contain">
          <div key={date} className="animate-rise px-6 pt-6 pb-10">
            <ItemDetail item={item} date={date} />
          </div>
        </div>
      </div>
    </div>
  );
}
