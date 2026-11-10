import { addMonths, compareYearMonth, monthGrid, monthPath, type YearMonth } from "@/lib/dates";
import { getAllDates, getArchivedMonths, getItemsForDates, getPlatformsWithData } from "@/lib/data";
import { Calendar } from "./Calendar";

export function MonthPage({ year, month }: YearMonth) {
  const months = getArchivedMonths();
  const first = months[0];
  const last = months.at(-1);
  const prev = addMonths({ year, month }, -1);
  const next = addMonths({ year, month }, 1);
  const dates = getAllDates();

  return (
    <Calendar
      year={year}
      month={month}
      itemsByDate={getItemsForDates(monthGrid(year, month))}
      platforms={getPlatformsWithData()}
      lastDate={dates.at(-1) ?? null}
      prevHref={first && compareYearMonth(prev, first) >= 0 ? monthPath(prev) : null}
      nextHref={last && compareYearMonth(next, last) <= 0 ? monthPath(next) : null}
    />
  );
}
