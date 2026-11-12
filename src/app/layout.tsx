import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { CalendarStateProvider } from "@/components/CalendarState";
import { Disclaimer } from "@/components/Disclaimer";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Capsule — what was trending, every day",
    template: "%s · Capsule",
  },
  description: "A calendar of the posts that took over the internet, one day at a time.",
};

export const viewport: Viewport = {
  themeColor: "#f4f4f2",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full">
        <CalendarStateProvider>{children}</CalendarStateProvider>
        <Disclaimer />
      </body>
    </html>
  );
}
