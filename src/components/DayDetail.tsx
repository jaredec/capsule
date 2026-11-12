import Image from "next/image";
import { ArrowUpRight, BadgeCheck, Heart, MessageCircle } from "lucide-react";
import { mediaSrc } from "@/lib/basePath";
import { archiveDateOf, formatLongDate, formatShortDate } from "@/lib/dates";
import { embedTarget } from "@/lib/embeds";
import { PLATFORM_META } from "@/lib/platforms";
import type { Item } from "@/lib/schema";
import { CroppedImage } from "./CroppedImage";
import { Embed } from "./Embed";
import { PlatformLogo } from "./PlatformLogo";

/** Text-only posts are stored with a rendered image of the post itself, which would repeat the text. */
export function isImageOfPost(item: Item): boolean {
  return Boolean(item.image && /^https:\/\/(?:x|twitter)\.com\/[^#]*$/.test(item.image.from));
}

/** Explains a featured post that went up before the day it blew up. */
function dateNote(item: Item, date: string): string | null {
  if (!item.post?.postedAt) return null;
  const posted = archiveDateOf(item.post.postedAt);
  if (posted >= date) return null;
  return `Posted ${formatShortDate(posted, date)}, peaked ${formatShortDate(date, posted)}.`;
}

/** The day's picture, filling whatever box it's given. */
export function DayMedia({ item, className = "" }: { item: Item; className?: string }) {
  if (!item.image) {
    const target = embedTarget(item);
    if (target) return <Embed target={target} title={item.title} />;
    return (
      <div className={`grid place-items-center bg-zinc-100 p-8 text-center text-2xl font-semibold text-zinc-400 ${className}`}>
        {item.title}
      </div>
    );
  }
  return <CroppedImage image={item.image} alt={item.title} sync className={className} />;
}

/** Everything about the day beside its picture: the headline, the post, what happened and where it was covered. */
export function DayInfo({
  item,
  date,
  besideToolbar = false,
}: {
  item: Item;
  date: string;
  /** On wide screens the date line sits level with a toolbar at the top right, and the headline starts below it. */
  besideToolbar?: boolean;
}) {
  const { post } = item;
  const note = dateNote(item, date);
  const likes = item.metrics?.likes;
  const replies = item.metrics?.replies;
  const platform = PLATFORM_META[item.platform].label;
  const showText = post?.text && !isImageOfPost(item);

  return (
    <div className="flex min-h-full flex-col">
      <p className={`text-[13px] text-zinc-500 tabular-nums ${besideToolbar ? "md:flex md:h-9 md:items-center md:pr-32" : ""}`}>
        {formatLongDate(date).replace(/, \d{4}$/, "")}
      </p>
      <h2 className={`${besideToolbar ? "mt-1.5 md:mt-3" : "mt-1.5"} text-[24px] leading-[1.15] font-semibold tracking-[-0.02em] text-balance text-zinc-950 md:text-[26px]`}>
        {item.title}
      </h2>

      {item.sourceUrl && (
        <a
          href={item.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="group mt-4 inline-flex h-9 items-center gap-2 self-start rounded-full bg-zinc-950 pr-3.5 pl-3 text-[14px] font-medium text-white transition-[background-color,scale] duration-150 hover:bg-zinc-800 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
        >
          <PlatformLogo platform={item.platform} mono className="size-3.5" />
          {item.kind === "video" ? `Watch on ${platform}` : `View on ${platform}`}
          <ArrowUpRight className="size-4 text-white/60 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </a>
      )}

      {post && (
        <div className="mt-5 flex items-center gap-2.5">
          {post.avatar ? (
            <Image
              src={mediaSrc(post.avatar)}
              alt=""
              width={36}
              height={36}
              unoptimized
              className="size-9 shrink-0 rounded-full bg-zinc-100"
            />
          ) : (
            <span className="size-9 shrink-0 rounded-full bg-zinc-200" />
          )}
          <div className="min-w-0 flex-1 leading-tight">
            <div className="flex items-center gap-1">
              <span className="truncate text-[14px] font-semibold text-zinc-900">{post.name}</span>
              {post.verified && (
                <BadgeCheck aria-label="Verified" className="size-4 shrink-0 fill-[#1d9bf0] text-white" />
              )}
            </div>
            <div className="truncate text-[13px] text-zinc-500">{post.handle}</div>
          </div>
          <PlatformLogo platform={item.platform} className="size-4 shrink-0 text-zinc-900" />
        </div>
      )}

      {showText && (
        <p className="mt-3 text-[15px] leading-[1.5] whitespace-pre-line text-pretty text-zinc-800">{post.text}</p>
      )}

      {(likes || replies || note) && (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-zinc-500 tabular-nums">
          {likes && (
            <span className="flex items-center gap-1.5">
              <Heart className="size-3.5" aria-hidden />
              {likes}
              <span className="sr-only">likes</span>
            </span>
          )}
          {replies && (
            <span className="flex items-center gap-1.5">
              <MessageCircle className="size-3.5" aria-hidden />
              {replies}
              <span className="sr-only">replies</span>
            </span>
          )}
          {note && <span>{note}</span>}
        </div>
      )}

      <div className="mt-6 border-t border-zinc-100 pt-5">
        <h3 className="text-[12px] font-medium text-zinc-400">What happened</h3>
        <p className="mt-1.5 text-[14px] leading-[1.6] text-pretty text-zinc-600">{item.summary}</p>
      </div>

      {item.references.length > 0 && (
        <div className="mt-5">
          <h3 className="text-[12px] font-medium text-zinc-400">Coverage</h3>
          <ul className="mt-1 -mx-2">
            {item.references.map((ref) => (
              <li key={ref.url}>
                <a
                  href={ref.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex items-start gap-2 rounded-lg px-2 py-1.5 text-[14px] leading-snug text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-950"
                >
                  <span className="min-w-0 flex-1">{ref.title}</span>
                  <ArrowUpRight className="mt-0.5 size-3.5 shrink-0 text-zinc-400 group-hover:text-zinc-900" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
