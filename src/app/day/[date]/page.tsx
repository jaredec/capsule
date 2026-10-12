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
      <Link href={monthPath({ year, month })} className="text-sm text-zinc-500 hover:text-zinc-900">
        ← Calendar
      </Link>
      <h1 className="mt-6 font-display text-4xl text-zinc-900 md:text-5xl">{formatLongDate(date)}</h1>

      <div className="mt-8 space-y-14">
        {day.items.map((item) => (
          <ItemDetail key={item.id} item={item} />
        ))}
      </div>

      <nav className="mt-16 flex justify-between border-t border-zinc-200 pt-6 text-sm">
        {archived.has(prev) ? (
          <Link href={`/day/${prev}`} className="text-zinc-500 hover:text-zinc-900">
            ← {formatLongDate(prev)}
          </Link>
        ) : (
          <span />
        )}
        {archived.has(next) && (
          <Link href={`/day/${next}`} className="text-zinc-500 hover:text-zinc-900">
            {formatLongDate(next)} →
          </Link>
        )}
      </nav>
    </div>
  );
}
