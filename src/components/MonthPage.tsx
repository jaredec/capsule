import { addMonths, compareYearMonth, monthGrid, monthPath, type YearMonth } from "@/lib/dates";
import { getAllDates, getArchivedMonths, getItemsForDates, getPlatformsWithData } from "@/lib/data";
import { Calendar } from "./Calendar";
import { isImageOfPost } from "./DayDetail";

/** The pictures each day of a month's weeks shows, so the calendar can load them before stepping there. */
function picturesOf({ year, month }: YearMonth): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [date, items] of Object.entries(getItemsForDates(monthGrid(year, month)))) {
    const srcs = items.flatMap((item) => (item.image && !isImageOfPost(item) ? [item.image.src] : []));
    if (srcs.length) out[date] = srcs;
  }
  return out;
}

export function MonthPage({ year, month }: YearMonth) {
  const months = getArchivedMonths();
  const first = months[0];
  const last = months.at(-1);
  const prev = addMonths({ year, month }, -1);
  const next = addMonths({ year, month }, 1);
  const dates = getAllDates();
  const hasPrev = Boolean(first && compareYearMonth(prev, first) >= 0);
  const hasNext = Boolean(last && compareYearMonth(next, last) <= 0);

  return (
    <Calendar
      year={year}
      month={month}
      itemsByDate={getItemsForDates(monthGrid(year, month))}
      neighborPictures={{ ...(hasPrev ? picturesOf(prev) : {}), ...(hasNext ? picturesOf(next) : {}) }}
      platforms={getPlatformsWithData()}
      lastDate={dates.at(-1) ?? null}
      prevHref={hasPrev ? monthPath(prev) : null}
      nextHref={hasNext ? monthPath(next) : null}
    />
  );
}
