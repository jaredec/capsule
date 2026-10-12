import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MonthPage } from "@/components/MonthPage";
import { MONTH_NAMES } from "@/lib/dates";
import { getArchivedMonths } from "@/lib/data";

export function generateStaticParams() {
  return getArchivedMonths().map(({ year, month }) => ({
    year: String(year),
    month: String(month).padStart(2, "0"),
  }));
}

function parseParams(params: { year: string; month: string }) {
  const year = Number(params.year);
  const month = Number(params.month);
  const exists = getArchivedMonths().some((m) => m.year === year && m.month === month);
  return exists ? { year, month } : null;
}

export async function generateMetadata({ params }: PageProps<"/[year]/[month]">): Promise<Metadata> {
  const parsed = parseParams(await params);
  return parsed ? { title: `${MONTH_NAMES[parsed.month - 1]} ${parsed.year}` } : {};
}

export default async function MonthRoute({ params }: PageProps<"/[year]/[month]">) {
  const parsed = parseParams(await params);
  if (!parsed) notFound();
  return <MonthPage {...parsed} />;
}
