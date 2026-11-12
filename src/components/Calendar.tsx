"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import {
  ViewTransition,
  addTransitionType,
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { mediaSrc } from "@/lib/basePath";
import { warmImages, whenIdle } from "@/lib/preload";
import {
  MONTH_NAMES,
  WEEKDAYS_SHORT,
  addDays,
  addMonths,
  formatLongDate,
  formatShortDate,
  formatWeekRange,
  monthGrid,
  parseIsoDate,
} from "@/lib/dates";
import { usePlatformFilter, useToday } from "@/lib/hooks";
import type { Item, Platform } from "@/lib/schema";
import {
  DAY_CARD_SHARE,
  DAY_IMAGE_SHARE,
  dayCardName,
  dayImageName,
  rememberCellRadius,
  type Step,
} from "@/lib/transitions";
import { useCalendarState, type CalendarView as View } from "./CalendarState";
import { CroppedImage } from "./CroppedImage";
import { DayModal } from "./DayModal";
import { isImageOfPost, picturesOfItem } from "./DayDetail";
import { PlatformSwitcher } from "./PlatformSwitcher";

type Props = {
  year: number;
  month: number;
  /** Items for every day of the month's weeks, including the days of neighboring months. */
  itemsByDate: Record<string, Item[]>;
  /** The pictures of the neighboring months' days, loaded ahead so stepping there paints at once. */
  neighborPictures: Record<string, string[]>;
  /** Platforms with anything archived; the rest are listed as coming soon. */
  platforms: Platform[];
  /** The archive's last day. */
  lastDate: string | null;
  prevHref: string | null;
  nextHref: string | null;
};

const WEEKDAY_ROW = 28;
/** Height over width of a day in the week view at its tallest: 3:4, the shape of the stored crops. */
const WEEK_CARD_RATIO = 4 / 3;
/** Width over height of a day in the month view at its widest, assuming six weeks. */
const MONTH_CELL_ASPECT = 1.3;

const STAGE_SHARE = {
  "month-next": "grid-next",
  "month-prev": "grid-prev",
  "week-next": "grid-next",
  "week-prev": "grid-prev",
  "view-month": "stage-swap",
  "view-week": "stage-swap",
  default: "none",
};
const HEADER_UPDATE = { "view-month": "header-move", "view-week": "header-move", default: "none" };
const LABEL_SHARE = {
  "month-next": "roll-next",
  "month-prev": "roll-prev",
  "week-next": "roll-next",
  "week-prev": "roll-prev",
  "view-month": "roll-next",
  "view-week": "roll-prev",
  default: "none",
};

// Cells settle in on the first paint only; later changes arrive with their own transitions.
let booted = false;

function readDayParam(): string | null {
  const day = new URLSearchParams(window.location.search).get("day");
  return day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
}

function urlWithDay(day: string | null): string {
  const url = new URL(window.location.href);
  if (day) url.searchParams.set("day", day);
  else url.searchParams.delete("day");
  return url.pathname + url.search;
}

export function Calendar({
  year,
  month,
  itemsByDate,
  neighborPictures,
  platforms,
  lastDate,
  prevHref,
  nextHref,
}: Props) {
  const router = useRouter();
  const today = useToday();
  const [platformParam, setPlatformParam] = usePlatformFilter();
  const available = useMemo(() => new Set(platforms), [platforms]);
  const platform: Platform = platformParam && available.has(platformParam) ? platformParam : (platforms[0] ?? "x");

  // The stagger comes off once played: the router hides and re-shows visited pages, which
  // would restart it.
  const [animateIn, setAnimateIn] = useState(() => !booted);
  const { view, setView, week: weekPick, setWeek: setWeekPick } = useCalendarState();
  useEffect(() => {
    booted = true;
    const timer = window.setTimeout(() => setAnimateIn(false), 1200);
    return () => window.clearTimeout(timer);
  }, []);

  const cells = useMemo(() => monthGrid(year, month), [year, month]);
  const weeks = cells.length / 7;
  const monthPrefix = `${year}-${String(month).padStart(2, "0")}-`;
  const weekStartOf = useCallback(
    (date: string) => {
      const i = cells.indexOf(date);
      return i < 0 ? null : cells[i - (i % 7)];
    },
    [cells],
  );

  const visible = useMemo(() => {
    const out: Record<string, Item> = {};
    for (const [date, items] of Object.entries(itemsByDate)) {
      const top = items.find((i) => i.platform === platform);
      if (top) out[date] = top;
    }
    return out;
  }, [itemsByDate, platform]);
  const archivedDates = useMemo(() => Object.keys(visible).sort(), [visible]);

  const picturesFor = useCallback(
    (dates: string[]) =>
      dates.flatMap((date) => {
        const item = visible[date];
        return (item ? picturesOfItem(item) : (neighborPictures[date] ?? [])).map(mediaSrc);
      }),
    [visible, neighborPictures],
  );

  // The rest of the month, then the months on either side, load once the page is idle.
  useEffect(
    () =>
      whenIdle(() => {
        warmImages(picturesFor(cells));
        warmImages(Object.values(neighborPictures).flat().map(mediaSrc));
      }),
    [picturesFor, cells, neighborPictures],
  );

  // The week shown: this week, else the month's latest archived week.
  const defaultWeek = useMemo(() => {
    const anchor =
      today && cells.includes(today) ? today : archivedDates.filter((d) => d.startsWith(monthPrefix)).at(-1);
    return (anchor && weekStartOf(anchor)) ?? cells[0];
  }, [today, cells, archivedDates, monthPrefix, weekStartOf]);
  const weekStart = weekPick && cells.includes(weekPick) ? weekPick : defaultWeek;
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  // The open day lives in `?day=`, so a day can be linked to and Back closes it. The URL is
  // only read on load and on popstate: the router re-renders synchronously on pushState, and
  // reading it during that render would mount the card outside its transition.
  const [selected, setSelected] = useState<string | null>(null);
  const pushedDay = useRef(false);

  useEffect(() => {
    const linked = readDayParam();
    const frame = linked
      ? requestAnimationFrame(() =>
          startTransition(() => {
            addTransitionType("day-open");
            setSelected(linked);
            setWeekPick(weekStartOf(linked));
          }),
        )
      : 0;
    const onPop = () => {
      const day = readDayParam();
      pushedDay.current = false;
      startTransition(() => {
        addTransitionType(day ? "day-open" : "day-close");
        setSelected(day);
      });
    };
    window.addEventListener("popstate", onPop);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("popstate", onPop);
    };
  }, [weekStartOf, setWeekPick]);

  const openDay = useCallback(
    (date: string) => {
      startTransition(() => {
        addTransitionType("day-open");
        setSelected(date);
        setWeekPick(weekStartOf(date));
      });
      window.history.pushState(null, "", urlWithDay(date));
      pushedDay.current = true;
    },
    [weekStartOf, setWeekPick],
  );

  const closeDay = useCallback(() => {
    if (pushedDay.current) {
      window.history.back();
      return;
    }
    startTransition(() => {
      addTransitionType("day-close");
      setSelected(null);
    });
    window.history.replaceState(null, "", urlWithDay(null));
  }, []);

  // The week follows the open day, so closing it lands on the day's card.
  const stepDay = useCallback(
    (date: string, step: Step) => {
      startTransition(() => {
        addTransitionType(step === "next" ? "day-next" : "day-prev");
        setSelected(date);
        setWeekPick(weekStartOf(date));
      });
      window.history.replaceState(null, "", urlWithDay(date));
    },
    [weekStartOf, setWeekPick],
  );

  // Back in the week view, the week is today's again rather than one browsed to earlier.
  const switchView = useCallback(
    async (next: View) => {
      if (next === "month") await warmImages(picturesFor(cells), 400);
      startTransition(() => {
        addTransitionType(`view-${next}`);
        setView(next);
        if (next === "week") setWeekPick(null);
      });
    },
    [setView, setWeekPick, picturesFor, cells],
  );

  // Weeks past the month's own continue in the neighboring month; weeks after the archive's
  // last day have nothing to show.
  const weekTarget = (step: Step): { week: string; href: string | null } | null => {
    const week = addDays(weekStart, step === "next" ? 7 : -7);
    if (step === "next" && lastDate && week > lastDate) return null;
    if (cells.includes(week)) return { week, href: null };
    const href = step === "next" ? nextHref : prevHref;
    return href ? { week, href } : null;
  };
  const canStep = (step: Step) =>
    view === "week" ? weekTarget(step) !== null : Boolean(step === "next" ? nextHref : prevHref);

  // The transition waits briefly for the destination's pictures, so it slides to them rather than
  // to empty cells that fill in one by one. Presses during the wait are dropped.
  const stepping = useRef(false);
  const step = async (dir: Step) => {
    if (stepping.current) return;
    if (view === "month") {
      const href = dir === "next" ? nextHref : prevHref;
      if (!href) return;
      const { year: y, month: m } = addMonths({ year, month }, dir === "next" ? 1 : -1);
      stepping.current = true;
      await warmImages(picturesFor(monthGrid(y, m)), 400);
      stepping.current = false;
      router.push(href, { scroll: false, transitionTypes: [`month-${dir}`] });
      return;
    }
    const target = weekTarget(dir);
    if (!target) return;
    stepping.current = true;
    await warmImages(picturesFor(Array.from({ length: 7 }, (_, i) => addDays(target.week, i))), 400);
    stepping.current = false;
    // Crossing into the neighboring month changes the week and the page in one transition.
    const href = target.href;
    startTransition(() => {
      addTransitionType(`week-${dir}`);
      setWeekPick(target.week);
      if (href) router.push(href, { scroll: false });
    });
  };
  useEffect(() => {
    if (prevHref) router.prefetch(prevHref);
    if (nextHref) router.prefetch(nextHref);
  }, [router, prevHref, nextHref]);

  const stepRef = useRef(step);
  useEffect(() => {
    stepRef.current = step;
  });

  useEffect(() => {
    if (selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "ArrowLeft") stepRef.current("prev");
      else if (e.key === "ArrowRight") stepRef.current("next");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  const swipe = useSwipe((dir) => stepRef.current(dir));

  const selectedIndex = selected ? archivedDates.indexOf(selected) : -1;
  const openItem = selected ? visible[selected] : undefined;
  const label = view === "week" ? formatWeekRange(weekStart) : `${MONTH_NAMES[month - 1]} ${year}`;
  const stepNoun = view === "week" ? "week" : "month";

  const cardProps = (date: string, index: number) => ({
    date,
    index,
    item: visible[date],
    pending: Boolean(lastDate && date > lastDate),
    isToday: date === today,
    isOpen: date === selected,
    animateIn,
    onOpen: openDay,
  });

  return (
    <div className="flex h-dvh flex-col overflow-hidden px-2.5 sm:px-5 md:px-8">
      {/* On wide screens the week sits with the header in the middle of the screen; the month
          fills the screen under it. */}
      <ViewTransition name="calendar-header" update={HEADER_UPDATE} default="none">
        <header
          data-under-card
          className={`flex shrink-0 flex-col items-center pt-6 pb-3 md:pt-8 md:pb-6 ${view === "week" ? "md:mt-auto" : ""}`}
        >
          <h1 className="flex items-center gap-[0.24em] text-[30px] leading-none font-semibold tracking-[-0.04em] text-zinc-950 md:text-[38px]">
            Trending on
            <PlatformSwitcher
              value={platform}
              available={available}
              onChange={(p) => setPlatformParam(p === platforms[0] ? null : p)}
            />
          </h1>
          <nav
            className="mt-3 flex items-center gap-1.5 md:mt-3.5 md:gap-3"
            aria-label={view === "week" ? "Week" : "Month"}
          >
            <div className="flex items-center gap-1">
              <StepButton step="prev" noun={stepNoun} disabled={!canStep("prev")} onStep={step} />
              <ViewTransition key={label} name="calendar-label" share={LABEL_SHARE} default="none">
                <span
                  aria-live="polite"
                  className="w-[8.25rem] text-center text-[14px] md:w-[9.5rem] md:text-[15px] font-medium tracking-[-0.01em] text-zinc-500 tabular-nums"
                >
                  {label}
                </span>
              </ViewTransition>
              <StepButton step="next" noun={stepNoun} disabled={!canStep("next")} onStep={step} />
            </div>
          </nav>
        </header>
      </ViewTransition>

      <main
        data-under-card
        className={`relative min-h-0 flex-1 [container-type:size] ${
          view === "week" ? "md:h-[min(calc(100dvh-236px),calc((100vw-136px)/7*var(--ratio)+100px))] md:flex-none" : ""
        }`}
        style={{ "--ratio": WEEK_CARD_RATIO } as React.CSSProperties}
        {...swipe}
      >
        {/* Level with the header's nav but flush with the grid's right edge, so the title and nav stay
            centered. It sits in a box the same width as the grid, outside the grid's own transition. */}
        <div
          className={
            view === "week"
              ? "pointer-events-none absolute inset-0"
              : "pointer-events-none absolute inset-y-0 left-1/2 w-full -translate-x-1/2 md:w-[min(100cqw,calc((100cqh-58px)/6*7*var(--aspect)+36px))]"
          }
          style={{ "--aspect": MONTH_CELL_ASPECT } as React.CSSProperties}
        >
          <ViewTransition name="view-toggle" update={HEADER_UPDATE} default="none">
            <button
              type="button"
              aria-pressed={view === "month"}
              aria-label={view === "month" ? "Show the week" : "Show the whole month"}
              title={view === "month" ? "Show the week" : "Show the whole month"}
              onClick={() => switchView(view === "month" ? "week" : "month")}
              className={`pointer-events-auto absolute right-0 bottom-[calc(100%+12px)] grid size-8 place-items-center rounded-full transition-[background-color,color,scale] duration-200 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 active:scale-90 md:bottom-[calc(100%+24px)] ${
                view === "month" ? "bg-zinc-950 text-white" : "text-zinc-500 hover:bg-black/[0.05] hover:text-zinc-900"
              }`}
            >
              <CalendarDays className="size-[17px]" strokeWidth={2} />
            </button>
          </ViewTransition>
        </div>
        <ViewTransition
          key={view === "week" ? weekStart : "month"}
          name="calendar-stage"
          share={STAGE_SHARE}
          default="none"
        >
          {view === "week" ? (
            <div className="absolute inset-0 grid grid-cols-2 grid-rows-4 gap-x-2 gap-y-3 md:grid-cols-7 md:grid-rows-1 md:gap-3">
              {weekDays.map((date, i) => (
                <WeekCard key={date} {...cardProps(date, i)} />
              ))}
              <button
                type="button"
                onClick={() => switchView("month")}
                className="flex flex-col items-center justify-center gap-1 rounded-[12px] bg-black/[0.04] text-[13px] font-medium text-zinc-500 transition-colors active:bg-black/[0.07] md:hidden"
              >
                All of {MONTH_NAMES[month - 1]}
                <ChevronRight className="size-4" strokeWidth={2.25} />
              </button>
            </div>
          ) : (
            <div
              className="absolute inset-y-0 left-1/2 flex w-full -translate-x-1/2 flex-col md:w-[min(100cqw,calc((100cqh-58px)/6*7*var(--aspect)+36px))]"
              style={{ "--aspect": MONTH_CELL_ASPECT } as React.CSSProperties}
            >
              <div
                className="grid shrink-0 grid-cols-7 gap-[3px] md:gap-1.5"
                style={{ height: WEEKDAY_ROW }}
                aria-hidden
              >
                {WEEKDAYS_SHORT.map((d) => (
                  <div
                    key={d}
                    className="px-1 text-center text-[11px] font-medium text-zinc-400 md:pl-2 md:text-left md:text-[12px]"
                  >
                    <span className="md:hidden">{d[0]}</span>
                    <span className="hidden md:inline">{d}</span>
                  </div>
                ))}
              </div>
              <div
                className="grid min-h-0 flex-1 grid-cols-7 gap-[3px] max-md:max-h-[calc((100cqw-18px)/7*4/3*var(--weeks)+(var(--weeks)-1)*3px)] md:gap-1.5"
                style={
                  { gridTemplateRows: `repeat(${weeks}, minmax(0, 1fr))`, "--weeks": weeks } as React.CSSProperties
                }
              >
                {cells.map((date, i) =>
                  date.startsWith(monthPrefix) ? (
                    <MonthCell key={date} {...cardProps(date, i)} />
                  ) : (
                    <div
                      key={date}
                      aria-hidden
                      className="rounded-[6px] bg-black/[0.018] sm:rounded-[9px] md:rounded-[12px]"
                    />
                  ),
                )}
              </div>
            </div>
          )}
        </ViewTransition>
      </main>

      <footer
        data-under-card
        className="flex shrink-0 items-center justify-center gap-1.5 py-3 text-[12px] text-zinc-400 md:mt-auto md:py-4"
      >
        <span>
          Capsule by{" "}
          <a href="https://www.jaredconnolly.com" className="text-zinc-500 transition-colors hover:text-zinc-900">
            Jared Connolly
          </a>
        </span>
        {lastDate && (
          <>
            <span aria-hidden>·</span>
            <span>Updated through {formatShortDate(lastDate)}</span>
          </>
        )}
      </footer>

      {/* Each overlay layer is its own boundary, mounted right here: React only runs a boundary's
          enter and exit when the boundary itself is what mounts or unmounts. */}
      {openItem && (
        <ViewTransition enter="backdrop-in" exit="backdrop-out" default="none">
          <div aria-hidden className="fixed inset-0 z-50 bg-zinc-950/35 backdrop-blur-[3px]" />
        </ViewTransition>
      )}
      {selected && openItem && (
        <ViewTransition enter="card-in" exit="card-out" default="none">
          <DayModal
            date={selected}
            item={openItem}
            prev={archivedDates[selectedIndex - 1] ?? null}
            next={archivedDates[selectedIndex + 1] ?? null}
            onStep={stepDay}
            onClose={closeDay}
          />
        </ViewTransition>
      )}
    </div>
  );
}

/** Horizontal swipes on touch screens step the week or month. */
function useSwipe(onSwipe: (step: Step) => void) {
  const start = useRef<{ x: number; y: number } | null>(null);
  return {
    onTouchStart: (e: React.TouchEvent) => {
      const t = e.touches[0];
      start.current = { x: t.clientX, y: t.clientY };
    },
    onTouchEnd: (e: React.TouchEvent) => {
      const s = start.current;
      start.current = null;
      if (!s) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - s.x;
      const dy = t.clientY - s.y;
      if (Math.abs(dx) > 56 && Math.abs(dx) > Math.abs(dy) * 1.5) onSwipe(dx < 0 ? "next" : "prev");
    },
  };
}

function StepButton({
  step,
  noun,
  disabled,
  onStep,
}: {
  step: Step;
  noun: string;
  disabled: boolean;
  onStep: (step: Step) => void;
}) {
  const label = `${step === "prev" ? "Previous" : "Next"} ${noun}`;
  const Icon = step === "prev" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onStep(step)}
      aria-label={label}
      title={`${label} (${step === "prev" ? "←" : "→"})`}
      className="grid size-8 place-items-center rounded-full text-zinc-500 transition-[background-color,color,scale] duration-150 ease-out hover:bg-black/[0.05] hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-zinc-900 active:scale-90 disabled:pointer-events-none disabled:text-zinc-300"
    >
      <Icon className="size-[18px]" strokeWidth={2.25} />
    </button>
  );
}

type CardProps = {
  date: string;
  index: number;
  item: Item | undefined;
  pending: boolean;
  isToday: boolean;
  isOpen: boolean;
  animateIn: boolean;
  onOpen: (date: string) => void;
};

const radius = "rounded-[6px] sm:rounded-[9px] md:rounded-[12px]";

/** Screenshots of text posts are set as type instead, so every day reads as a picture or a headline. */
function DayMediaTile({
  item,
  date,
  isOpen,
  text,
  lines,
}: {
  item: Item;
  date: string;
  isOpen: boolean;
  text: string;
  lines: number;
}) {
  const asText = !item.image || isImageOfPost(item);
  const media = asText ? (
    <span className="absolute inset-0 bg-zinc-900 [container-type:size]">
      <span
        className="absolute inset-x-0 bottom-0 overflow-hidden p-[clamp(6px,7cqw,16px)] text-[clamp(10px,8cqw,20px)] leading-[1.18] font-semibold tracking-[-0.015em] text-balance text-white @max-[88px]:hidden"
        style={{ display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: lines }}
      >
        {text}
      </span>
      {item.post?.avatar && (
        <Image
          src={mediaSrc(item.post.avatar)}
          alt=""
          width={28}
          height={28}
          unoptimized
          loading="eager"
          className="absolute inset-0 m-auto hidden size-[min(28px,60cqw)] rounded-full @max-[88px]:block"
        />
      )}
    </span>
  ) : (
    <CroppedImage
      image={item.image!}
      className="absolute inset-0 transition-transform duration-500 ease-out group-hover:scale-[1.03]"
    />
  );
  return isOpen ? (
    media
  ) : (
    <ViewTransition name={dayImageName(date)} share={DAY_IMAGE_SHARE} default="none">
      {media}
    </ViewTransition>
  );
}

/** The cell's box, which grows into the open card; the open day's box belongs to the card. */
function CardBox({ date, isOpen, children }: { date: string; isOpen: boolean; children: React.ReactNode }) {
  return isOpen ? (
    children
  ) : (
    <ViewTransition name={dayCardName(date)} share={DAY_CARD_SHARE} default="none">
      {children}
    </ViewTransition>
  );
}

const cardButton =
  "group relative overflow-hidden text-left outline-offset-2 transition-[scale,box-shadow] duration-200 ease-out hover:shadow-[0_12px_28px_-14px_rgb(0_0_0/0.5)] focus-visible:outline-2 focus-visible:outline-zinc-900 active:scale-[0.97]";

function WeekCard({ date, index, item, pending, isToday, isOpen, animateIn, onOpen }: CardProps) {
  const { year, month, day } = parseIsoDate(date);
  const weekday = WEEKDAYS_SHORT[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  const asText = item && (!item.image || isImageOfPost(item));

  return (
    <div
      className={`flex min-h-0 flex-col ${animateIn ? "cell-in" : ""}`}
      style={animateIn ? ({ "--i": index } as React.CSSProperties) : undefined}
    >
      <p className="mb-1.5 flex h-5 shrink-0 items-center gap-1.5 text-[12px] font-medium text-zinc-400 tabular-nums md:mb-2">
        {weekday}
        <span
          className={
            isToday
              ? "inline-grid h-5 min-w-5 place-items-center rounded-full bg-zinc-950 px-1.5 text-[11px] font-semibold text-white"
              : "text-zinc-600"
          }
        >
          {day}
        </span>
      </p>
      {item ? (
        <CardBox date={date} isOpen={isOpen}>
          <button
            type="button"
            data-day={date}
            onClick={(e) => {
              rememberCellRadius(e.currentTarget);
              onOpen(date);
            }}
            aria-label={`${formatLongDate(date)}: ${item.title}`}
            className={`${cardButton} min-h-0 flex-1 rounded-[12px] md:rounded-[16px]`}
          >
            <DayMediaTile
              item={item}
              date={date}
              isOpen={isOpen}
              text={(asText && item.post?.text) || item.title}
              lines={9}
            />
          </button>
        </CardBox>
      ) : (
        <div
          className={`min-h-0 flex-1 rounded-[12px] md:rounded-[16px] ${pending ? "bg-black/[0.025]" : "bg-black/[0.04]"}`}
        />
      )}
      <p className="mt-2.5 hidden h-[54px] shrink-0 overflow-hidden text-[13px] leading-snug font-medium text-pretty text-zinc-700 md:line-clamp-3">
        {item?.title}
      </p>
    </div>
  );
}

function MonthCell({ date, index, item, pending, isToday, isOpen, animateIn, onOpen }: CardProps) {
  const { day } = parseIsoDate(date);
  const enter = animateIn ? "cell-in" : "";
  const style = animateIn ? ({ "--i": index } as React.CSSProperties) : undefined;
  const number = (onImage: boolean) =>
    isToday ? (
      <span className="inline-grid h-[18px] min-w-[18px] place-items-center rounded-full bg-zinc-950 px-1 text-[10px] font-semibold text-white tabular-nums md:h-5 md:min-w-5 md:px-1.5 md:text-[11px]">
        <span className="[text-box:trim-both_cap_alphabetic]">{day}</span>
      </span>
    ) : (
      <span
        className={`text-[10px] font-semibold tabular-nums md:text-[12px] ${
          onImage ? "text-white [text-shadow:0_1px_3px_rgb(0_0_0/0.55)]" : "text-zinc-400"
        }`}
      >
        {day}
      </span>
    );

  if (!item) {
    return (
      <div
        style={style}
        className={`${enter} ${radius} px-1.5 py-1 md:px-2.5 md:py-2 ${pending ? "bg-black/[0.025]" : "bg-black/[0.04]"}`}
      >
        {number(false)}
      </div>
    );
  }

  return (
    <CardBox date={date} isOpen={isOpen}>
      <button
        type="button"
        data-day={date}
        style={style}
        onClick={(e) => {
          rememberCellRadius(e.currentTarget);
          onOpen(date);
        }}
        aria-label={`${formatLongDate(date)}: ${item.title}`}
        className={`${enter} ${cardButton} ${radius}`}
      >
        <DayMediaTile item={item} date={date} isOpen={isOpen} text={item.title} lines={3} />
        <span className="absolute top-1 left-1.5 md:top-2 md:left-2.5">{number(true)}</span>
      </button>
    </CardBox>
  );
}
