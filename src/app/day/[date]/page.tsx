import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ItemDetail } from "@/components/ItemDetail";
import { addDays, formatLongDate, isValidIsoDate, monthPath, parseIsoDate } from "@/lib/dates";
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

export default async function DayRoute({ params }: PageProps<"/day/[date]">) {
  const { date } = await params;
  const day = load(date);
  if (!day) notFound();

  const { year, month } = parseIsoDate(date);
  const archived = new Set(getDatesWithItems());
  const prev = addDays(date, -1);
  const next = addDays(date, 1);

  return (
    <div className="mx-auto max-w-2xl">
      <Link href={monthPath({ year, month })} className="text-sm text-zinc-500 hover:text-zinc-200">
        ← Back to calendar
      </Link>
      <p className="mt-8 text-xs uppercase tracking-[0.2em] text-zinc-500">What happened</p>
      <h1 className="font-display text-4xl text-zinc-50 md:text-5xl">{formatLongDate(date)}</h1>

      <div className="mt-10 space-y-14">
        {day.items.map((item) => (
          <ItemDetail key={item.id} item={item} />
        ))}
      </div>

      <nav className="mt-16 flex justify-between border-t border-white/10 pt-6 text-sm">
        {archived.has(prev) ? (
          <Link href={`/day/${prev}`} className="text-zinc-400 hover:text-white">
            ← {formatLongDate(prev)}
          </Link>
        ) : (
          <span />
        )}
        {archived.has(next) && (
          <Link href={`/day/${next}`} className="text-zinc-400 hover:text-white">
            {formatLongDate(next)} →
          </Link>
        )}
      </nav>
    </div>
  );
}
