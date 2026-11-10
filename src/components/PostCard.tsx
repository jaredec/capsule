import Image from "next/image";
import { ArrowUpRight, BadgeCheck, Heart, MessageCircle, Play } from "lucide-react";
import { mediaSrc } from "@/lib/basePath";
import { archiveDateOf, formatShortDate } from "@/lib/dates";
import type { Item } from "@/lib/schema";
import { CroppedImage } from "./CroppedImage";
import { XLogo } from "./XLogo";

/** Text-only posts are stored with a rendered image of the post itself, which would repeat the text. */
function isImageOfPost(item: Item): boolean {
  return Boolean(item.image && /^https:\/\/(?:x|twitter)\.com\//.test(item.image.from));
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** The featured post drawn from its snapshot, so it shows instantly and never depends on X's embed script. */
export function PostCard({ item, date }: { item: Item & { post: NonNullable<Item["post"]> }; date: string }) {
  const { post } = item;
  const media = item.image && !isImageOfPost(item) ? item.image : null;
  const video = item.kind === "video";
  const posted = post.postedAt ? archiveDateOf(post.postedAt) : date;
  const likes = item.metrics?.likes;
  const replies = item.metrics?.replies;

  const body = (
    <>
      <div className="flex items-center gap-3">
        {post.avatar ? (
          <Image
            src={mediaSrc(post.avatar)}
            alt=""
            width={40}
            height={40}
            unoptimized
            className="size-10 shrink-0 rounded-full bg-zinc-100"
          />
        ) : (
          <span className="size-10 shrink-0 rounded-full bg-zinc-200" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <span className="truncate text-[15px] leading-5 font-semibold text-zinc-900">{post.name}</span>
            {post.verified && (
              <BadgeCheck aria-label="Verified" className="size-[18px] shrink-0 fill-[#1d9bf0] text-white" />
            )}
          </div>
          <div className="truncate text-sm leading-5 text-zinc-500">
            {post.handle} · {formatShortDate(posted, date)}
          </div>
        </div>
        <XLogo className="size-[18px] shrink-0 text-zinc-900" />
      </div>

      {post.text && (
        <p className="mt-3 text-[15px] leading-[1.45] whitespace-pre-line text-zinc-900">{post.text}</p>
      )}

      {media && (
        <div className="relative mt-3">
          <CroppedImage
            image={media}
            aspect={clamp(media.width / media.height, 1, 16 / 9)}
            alt={item.title}
            className="w-full rounded-xl ring-1 ring-black/5"
          />
          {video && (
            <span className="absolute inset-0 grid place-items-center">
              <span className="grid size-14 place-items-center rounded-full bg-black/60 text-white backdrop-blur-sm transition-transform duration-200 group-hover:scale-105">
                <Play className="ml-[3px] size-6 fill-current" />
              </span>
            </span>
          )}
        </div>
      )}

      <div className="mt-3 flex items-center gap-5 text-sm text-zinc-500 tabular-nums">
        {likes && (
          <span className="flex items-center gap-1.5">
            <Heart className="size-4" aria-hidden />
            {likes}
            <span className="sr-only">likes</span>
          </span>
        )}
        {replies && (
          <span className="flex items-center gap-1.5">
            <MessageCircle className="size-4" aria-hidden />
            {replies}
            <span className="sr-only">replies</span>
          </span>
        )}
        {item.sourceUrl && (
          <span className="ml-auto flex items-center gap-1 font-medium text-zinc-900">
            {video ? "Watch on X" : "View on X"}
            <ArrowUpRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </span>
        )}
      </div>
    </>
  );

  const card = "group block rounded-2xl bg-white p-4 ring-1 ring-black/[0.07] shadow-[0_1px_2px_rgb(0_0_0/0.04)]";
  if (!item.sourceUrl) return <div className={card}>{body}</div>;
  return (
    <a
      href={item.sourceUrl}
      target="_blank"
      rel="noreferrer"
      className={`${card} transition-shadow duration-200 hover:shadow-[0_8px_24px_-8px_rgb(0_0_0/0.18)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900`}
    >
      {body}
    </a>
  );
}
