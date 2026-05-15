import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const revalidate = 3600;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const platform = searchParams.get("platform") ?? "x";
  const month = searchParams.get("month");

  let q = supabase
    .from("trends")
    .select("id, date, platform, title, description, link, image_url, created_at")
    .eq("platform", platform)
    .order("date", { ascending: false });

  if (month) {
    const [y, m] = month.split("-").map(Number);
    const start = `${y}-${String(m).padStart(2, "0")}-01`;
    const end = new Date(y, m, 1).toISOString().slice(0, 10);
    q = q.gte("date", start).lt("date", end);
  }

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(
    { trends: data ?? [] },
    { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } },
  );
}
