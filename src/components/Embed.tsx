"use client";

import { useEffect, useRef } from "react";
import type { Item } from "@/lib/schema";

declare global {
  interface Window {
    twttr?: { widgets?: { load: (el?: HTMLElement) => void } };
  }
}

function loadScript(src: string): Promise<void> {
  const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
  if (existing) {
    return existing.dataset.loaded ? Promise.resolve() : new Promise((r) => existing.addEventListener("load", () => r()));
  }
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.addEventListener("load", () => {
      script.dataset.loaded = "true";
      resolve();
    });
    document.body.appendChild(script);
  });
}

function XPostEmbed({ url }: { url: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    loadScript("https://platform.twitter.com/widgets.js").then(() => {
      if (ref.current) window.twttr?.widgets?.load(ref.current);
    });
  }, [url]);
  return (
    <div ref={ref} className="min-h-24 [&_.twitter-tweet]:mx-auto!">
      <blockquote className="twitter-tweet" data-theme="dark" data-dnt="true">
        <a href={url.replace("https://x.com/", "https://twitter.com/")}>View post on X</a>
      </blockquote>
    </div>
  );
}

function youtubeId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/);
  return match?.[1] ?? null;
}

function tiktokId(url: string): string | null {
  return url.match(/tiktok\.com\/@[^/]+\/video\/(\d+)/)?.[1] ?? null;
}

const X_STATUS_URL = /^https:\/\/(?:x|twitter)\.com\/\w+\/status\/\d+/;

/** Renders the original post inline when we have a URL the platform lets us embed. */
export function Embed({ item }: { item: Item }) {
  const url = item.sourceUrl;
  if (!url) return null;

  if (item.platform === "x" && X_STATUS_URL.test(url)) {
    return <XPostEmbed url={url} />;
  }

  const yt = item.platform === "youtube" ? youtubeId(url) : null;
  if (yt) {
    return (
      <iframe
        className="aspect-video w-full rounded-xl border border-white/10"
        src={`https://www.youtube-nocookie.com/embed/${yt}`}
        title={item.title}
        allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    );
  }

  const tt = item.platform === "tiktok" ? tiktokId(url) : null;
  if (tt) {
    return (
      <iframe
        className="mx-auto h-[740px] w-full max-w-[340px] rounded-xl border border-white/10"
        src={`https://www.tiktok.com/embed/v2/${tt}`}
        title={item.title}
        allow="encrypted-media"
        allowFullScreen
      />
    );
  }

  const ig = item.platform === "instagram" ? url.match(/instagram\.com\/(?:p|reel)\/([\w-]+)/)?.[1] : null;
  if (ig) {
    return (
      <iframe
        className="mx-auto h-[640px] w-full max-w-[400px] rounded-xl border border-white/10 bg-white"
        src={`https://www.instagram.com/p/${ig}/embed`}
        title={item.title}
        allowFullScreen
      />
    );
  }

  return null;
}
