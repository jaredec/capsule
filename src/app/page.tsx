import { MonthPage } from "@/components/MonthPage";
import { getLatestMonth } from "@/lib/data";

export default function Home() {
  const latest = getLatestMonth();
  if (!latest) {
    return <p className="text-zinc-400">Nothing archived yet. Run `npm run collect` to capture your first day.</p>;
  }
  return <MonthPage {...latest} />;
}
