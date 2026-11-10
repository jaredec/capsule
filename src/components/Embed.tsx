import type { EmbedTarget } from "@/lib/embeds";

export function Embed({ target, title }: { target: EmbedTarget; title: string }) {
  switch (target.kind) {
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
