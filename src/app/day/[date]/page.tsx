import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayInfo, DayMedia } from "@/components/DayDetail";
import { PlatformLogo } from "@/components/PlatformLogo";
import { MONTH_NAMES, formatLongDate, formatShortDate, isValidIsoDate, monthPath, parseIsoDate } from "@/lib/dates";
import { getDatesWithItems, getDay } from "@/lib/data";

export function generateStaticParams() {
  return getDatesWithItems().map((date) => ({ date }));
}

function load(date: string) {
  if (!isValidIsoDate(date)) return null;
  const day = getDay(date);
  return day && day.items.length > 0 ? day : null;
}

export async function generateMetadata({ params }: PageProps<"/day/[date]">): Promise<Metadata> {
  const { date } = await params;
  const day = load(date);
  if (!day) return {};
  return {
    title: `${formatLongDate(date)} — ${day.items[0].title}`,
    description: day.items[0].summary,
  };
}

function Neighbor({ date, step }: { date: string | undefined; step: "prev" | "next" }) {
  const label = step === "prev" ? "Previous day" : "Next day";
  const Icon = step === "prev" ? ChevronLeft : ChevronRight;
  const base = "grid size-9 place-items-center rounded-full transition-colors";
  if (!date) {
    return (
      <span aria-disabled className={`${base} text-zinc-300`}>
        <Icon className="size-[18px]" strokeWidth={2.25} />
      </span>
    );
  }
  return (
    <Link
      href={`/day/${date}`}
      aria-label={`${label}, ${formatShortDate(date)}`}
      className={`${base} text-zinc-500 hover:bg-black/[0.05] hover:text-zinc-900`}
    >
      <Icon className="size-[18px]" strokeWidth={2.25} />
    </Link>
  );
}

export default async function DayRoute({ params }: PageProps<"/day/[date]">) {
  const { date } = await params;
  const day = load(date);
  if (!day) notFound();

  const item = day.items[0];
  const { year, month } = parseIsoDate(date);
  const dates = getDatesWithItems();
  const index = dates.indexOf(date);

  return (
    <div className="flex min-h-dvh flex-col items-center px-3 pt-6 pb-8 md:px-8 md:pt-8">
      <header className="flex w-full max-w-[980px] items-center justify-between">
        <Link
          href={monthPath({ year, month })}
          className="-ml-2 inline-flex items-center gap-1.5 rounded-full py-1.5 pr-3 pl-2 text-[15px] font-medium tracking-[-0.01em] text-zinc-500 transition-colors hover:bg-black/[0.05] hover:text-zinc-900"
        >
          <ChevronLeft className="size-[18px]" strokeWidth={2.25} />
          {MONTH_NAMES[month - 1]} {year}
        </Link>
        <span className="flex items-center gap-1.5 text-[15px] font-semibold tracking-[-0.02em] text-zinc-950">
          Trending on <PlatformLogo platform={item.platform} className="size-3.5" />
        </span>
        <nav className="-mr-2 flex items-center" aria-label="Other days">
          <Neighbor date={dates[index - 1]} step="prev" />
          <Neighbor date={dates[index + 1]} step="next" />
        </nav>
      </header>

      <article className="mt-5 flex w-full max-w-[980px] flex-col overflow-hidden rounded-[22px] bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.04),0_16px_48px_-24px_rgb(0_0_0/0.3)] md:mt-6 md:h-[min(620px,calc(100dvh-120px))] md:flex-row">
        <div className="relative aspect-[4/3] w-full shrink-0 bg-zinc-100 md:aspect-auto md:h-full md:w-[46%]">
          <DayMedia item={item} className="absolute inset-0" />
        </div>
        <div className="min-h-0 flex-1 px-5 pt-5 pb-6 md:overflow-y-auto md:px-8 md:pt-7 md:pb-7">
          <DayInfo item={item} date={date} />
        </div>
      </article>
    </div>
  );
}
