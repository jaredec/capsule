import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { CroppedImage } from "@/components/CroppedImage";
import { ItemDetail } from "@/components/ItemDetail";
import { MONTH_NAMES, addDays, formatLongDate, formatShortDate, isValidIsoDate, monthPath, parseIsoDate } from "@/lib/dates";
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

function Neighbor({ date, direction }: { date: string; direction: "prev" | "next" }) {
  const item = load(date)?.items[0];
  if (!item) return <span />;
  const Chevron = direction === "prev" ? ChevronLeft : ChevronRight;
  return (
    <Link
      href={`/day/${date}`}
      className={`group flex min-w-0 items-center gap-3 rounded-2xl p-2 transition-colors hover:bg-white ${
        direction === "next" ? "flex-row-reverse text-right" : ""
      }`}
    >
      <Chevron className="size-5 shrink-0 text-zinc-400 group-hover:text-zinc-900" />
      {item.image && <CroppedImage image={item.image} aspect={1} className="size-12 shrink-0 rounded-xl" />}
      <span className="min-w-0">
        <span className="block text-xs text-zinc-500">{formatShortDate(date)}</span>
        <span className="line-clamp-2 text-sm leading-snug font-medium text-zinc-900">{item.title}</span>
      </span>
    </Link>
  );
}

export default async function DayRoute({ params }: PageProps<"/day/[date]">) {
  const { date } = await params;
  const day = load(date);
  if (!day) notFound();

  const { year, month } = parseIsoDate(date);

  return (
    <div className="mx-auto max-w-[600px]">
      <Link
        href={monthPath({ year, month })}
        className="-ml-1 inline-flex items-center gap-1 text-sm text-zinc-500 transition-colors hover:text-zinc-900"
      >
        <ChevronLeft className="size-4" />
        {MONTH_NAMES[month - 1]} {year}
      </Link>
      <p className="mt-6 text-sm font-medium text-zinc-500">{formatLongDate(date)}</p>

      <div className="mt-2">
        <ItemDetail item={day.items[0]} date={date} as="h1" />
      </div>

      <nav className="mt-14 grid grid-cols-2 gap-4 border-t border-zinc-200 pt-6" aria-label="Other days">
        <Neighbor date={addDays(date, -1)} direction="prev" />
        <Neighbor date={addDays(date, 1)} direction="next" />
      </nav>
    </div>
  );
}
