"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { ViewTransition, useEffect, useRef } from "react";
import { mediaSrc } from "@/lib/basePath";
import { formatLongDate } from "@/lib/dates";
import type { Item } from "@/lib/schema";
import { DAY_CARD_SHARE, DAY_IMAGE_SHARE, dayCardName, dayImageName, type Step } from "@/lib/transitions";
import { DayInfo, DayMedia } from "./DayDetail";

/** The open day: a card over the calendar on wide screens, a sheet from the bottom on phones. */
export function DayModal({
  date,
  item,
  prev,
  next,
  onStep,
  onClose,
}: {
  date: string;
  item: Item;
  prev: string | null;
  next: string | null;
  onStep: (date: string, step: Step) => void;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const infoRef = useRef<HTMLDivElement>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);

  const shownDate = useRef(date);
  useEffect(() => {
    shownDate.current = date;
  }, [date]);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus({ preventScroll: true });
    return () => {
      const cell = document.querySelector<HTMLElement>(`[data-day="${shownDate.current}"]`);
      (cell ?? opener)?.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft" && prev) onStep(prev, "prev");
      else if (e.key === "ArrowRight" && next) onStep(next, "next");
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prev, next, onStep, onClose]);

  useEffect(() => {
    infoRef.current?.scrollTo({ top: 0 });
  }, [date]);

  const iconButton =
    "grid size-8 place-items-center rounded-full text-zinc-700 transition-[background-color,color,scale] duration-150 hover:bg-black/[0.06] hover:text-zinc-950 active:scale-90 disabled:pointer-events-none disabled:text-zinc-300 focus-visible:outline-2 focus-visible:outline-zinc-900";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={formatLongDate(date)}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <ViewTransition name={dayCardName(date)} share={DAY_CARD_SHARE} default="none">
        <div
          className="relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[22px] bg-white shadow-[var(--card-shadow)] md:h-[min(620px,calc(100dvh-48px))] md:max-w-[980px] md:rounded-[22px]"
          onTouchStart={(e) => {
            const t = e.touches[0];
            touch.current = { x: t.clientX, y: t.clientY };
          }}
          onTouchEnd={(e) => {
            const s = touch.current;
            touch.current = null;
            if (!s) return;
            const t = e.changedTouches[0];
            const dx = t.clientX - s.x;
            const dy = t.clientY - s.y;
            if (Math.abs(dx) < 56 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
            if (dx < 0 && next) onStep(next, "next");
            else if (dx > 0 && prev) onStep(prev, "prev");
          }}
        >
          <ViewTransition
            key={date}
            enter={{
              "day-next": "step-in-next",
              "day-prev": "step-in-prev",
              default: "none",
            }}
            exit={{
              "day-next": "step-out-next",
              "day-prev": "step-out-prev",
              default: "none",
            }}
            default="none"
          >
            {/* On wide screens the picture is the card's background, and the day's story floats over it
                in a panel only as tall as its content. */}
            <div className="relative flex min-h-0 flex-1 flex-col md:block">
              {item.image && (
                <Image
                  src={mediaSrc(item.image.src)}
                  alt=""
                  width={item.image.width}
                  height={item.image.height}
                  unoptimized
                  loading="eager"
                  aria-hidden
                  className="absolute inset-0 hidden size-full scale-125 object-cover blur-3xl saturate-150 md:block"
                />
              )}
              <div className="relative aspect-[4/3] max-h-[44dvh] w-full shrink-0 bg-zinc-100 md:absolute md:inset-y-0 md:left-0 md:aspect-auto md:max-h-none md:w-[62%] md:bg-transparent">
                <ViewTransition name={dayImageName(date)} share={DAY_IMAGE_SHARE} default="none">
                  {/* The fade belongs to the picture itself, so the opening morph carries it from the first frame. */}
                  <DayMedia
                    item={item}
                    className="absolute inset-0 md:bg-transparent md:[mask-image:linear-gradient(to_left,transparent,black_20%)]"
                  />
                </ViewTransition>
              </div>
              <div
                ref={infoRef}
                data-day-panel
                className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-5 pb-6 md:absolute md:right-4 md:bottom-4 md:max-h-[calc(100%-76px)] md:w-[400px] md:rounded-[18px] md:bg-white/90 md:px-6 md:pt-5 md:pb-6 md:shadow-[0_0_0_1px_rgb(0_0_0/0.05),0_12px_40px_-12px_rgb(0_0_0/0.35)] md:backdrop-blur-xl"
              >
                <DayInfo item={item} date={date} floating />
              </div>
            </div>
          </ViewTransition>

          <div data-day-toolbar className="absolute top-4 right-4 flex items-center gap-0.5 rounded-full bg-white/85 p-0.5 shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_2px_8px_-2px_rgb(0_0_0/0.15)] backdrop-blur-md">
            <button
              type="button"
              className={iconButton}
              disabled={!prev}
              onClick={() => prev && onStep(prev, "prev")}
              aria-label="Previous day"
              title="Previous day (←)"
            >
              <ChevronLeft className="size-[18px]" strokeWidth={2.25} />
            </button>
            <button
              type="button"
              className={iconButton}
              disabled={!next}
              onClick={() => next && onStep(next, "next")}
              aria-label="Next day"
              title="Next day (→)"
            >
              <ChevronRight className="size-[18px]" strokeWidth={2.25} />
            </button>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              className={iconButton}
              aria-label="Close"
              title="Close (Esc)"
            >
              <X className="size-[18px]" strokeWidth={2.25} />
            </button>
          </div>
        </div>
      </ViewTransition>
    </div>
  );
}
