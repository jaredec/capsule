import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: {
    default: "Capsule — what the internet was laughing at",
    template: "%s · Capsule",
  },
  description: "A daily archive of the memes and viral moments that took over the internet.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-6 md:px-8">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-full bg-zinc-900 text-sm font-bold text-amber-300">
              c
            </span>
            <span className="text-lg font-semibold tracking-tight text-zinc-900">capsule</span>
          </Link>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-5 pb-20 pt-2 md:px-8">{children}</main>
        <footer className="mx-auto w-full max-w-7xl px-5 py-8 text-xs text-zinc-400 md:px-8">
          Days run midnight to midnight Pacific. Content belongs to its original creators.
        </footer>
      </body>
    </html>
  );
}
