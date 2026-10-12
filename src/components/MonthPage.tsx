import { addMonths, compareYearMonth, monthPath, type YearMonth } from "@/lib/dates";
import { getAllDates, getArchivedMonths, getMonthItems } from "@/lib/data";
import { Calendar } from "./Calendar";

export function MonthPage({ year, month }: YearMonth) {
  const months = getArchivedMonths();
  const first = months[0];
  const last = months.at(-1);
  const prev = addMonths({ year, month }, -1);
  const next = addMonths({ year, month }, 1);

  return (
    <Calendar
      year={year}
      month={month}
      itemsByDate={getMonthItems({ year, month })}
      firstDate={getAllDates()[0] ?? null}
      prevHref={first && compareYearMonth(prev, first) >= 0 ? monthPath(prev) : null}
      nextHref={last && compareYearMonth(next, last) <= 0 ? monthPath(next) : null}
    />
  );
}
