import Calendar from "@/components/calendar";
import trendsData from "@/data/trends.json";
import type { Trend } from "@/lib/types";

export default function Page() {
  return <Calendar trends={trendsData as Trend[]} />;
}
