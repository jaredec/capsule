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
          <Link href="/" className="font-display text-[28px] leading-none text-zinc-900">
            Capsule
          </Link>
          <a href="https://www.jaredconnolly.com" className="text-sm text-zinc-500 transition-colors hover:text-zinc-900">
            Jared Connolly
          </a>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-5 pt-4 pb-20 md:px-8">{children}</main>
        <footer className="mx-auto w-full max-w-7xl border-t border-zinc-200/70 px-5 py-6 text-xs text-zinc-400 md:px-8">
          Days run midnight to midnight Pacific. Posts belong to their original creators.
        </footer>
      </body>
    </html>
  );
}
