import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(url, anonKey);

export type Trend = {
  id: number;
  date: string;
  platform: string;
  title: string;
  description: string;
  link: string | null;
  image_url: string | null;
  created_at: string;
};
