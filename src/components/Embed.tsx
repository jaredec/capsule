"use client";

import { useEffect, useRef } from "react";
import type { EmbedTarget } from "@/lib/embeds";

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
      <blockquote className="twitter-tweet" data-theme="light" data-dnt="true">
        <a href={url.replace("https://x.com/", "https://twitter.com/")}>View post on X</a>
      </blockquote>
    </div>
  );
}

export function Embed({ target, title }: { target: EmbedTarget; title: string }) {
  switch (target.kind) {
    case "x":
      return <XPostEmbed url={target.url} />;
    case "youtube":
      return (
        <iframe
          className="aspect-video w-full rounded-2xl"
          src={`https://www.youtube-nocookie.com/embed/${target.id}`}
          title={title}
          allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      );
    case "tiktok":
      return (
        <iframe
          className="mx-auto h-[740px] w-full max-w-[340px] rounded-2xl"
          src={`https://www.tiktok.com/embed/v2/${target.id}`}
          title={title}
          allow="encrypted-media"
          allowFullScreen
        />
      );
    case "instagram":
      return (
        <iframe
          className="mx-auto h-[640px] w-full max-w-[400px] rounded-2xl border border-zinc-200 bg-white"
          src={`https://www.instagram.com/p/${target.id}/embed`}
          title={title}
          allowFullScreen
        />
      );
  }
}
