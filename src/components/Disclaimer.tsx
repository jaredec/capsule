"use client";

import { useEffect, useRef } from "react";

const SEEN_KEY = "capsule:disclaimer-seen";
/** Fired when a first-time visitor dismisses the disclaimer, so the calendar can show what it does. */
export const INTRO_EVENT = "capsule:intro";

/** Shown once per browser, on the first visit. */
export function Disclaimer() {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    try {
      if (localStorage.getItem(SEEN_KEY)) return;
    } catch {
      return;
    }
    dialog.current?.showModal();
    dialog.current?.focus();
  }, []);

  const remember = () => {
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {}
    window.dispatchEvent(new Event(INTRO_EVENT));
  };

  return (
    <dialog
      ref={dialog}
      onClose={remember}
      onKeyDown={(e) => e.stopPropagation()}
      aria-labelledby="disclaimer-title"
      tabIndex={-1}
      className="m-auto outline-none w-[min(calc(100vw-32px),400px)] rounded-[22px] bg-white p-6 text-zinc-950 shadow-(--card-shadow) transition-[opacity,scale,display,overlay] transition-discrete duration-300 ease-(--ease-sheet) backdrop:bg-black/25 backdrop:backdrop-blur-[2px] backdrop:transition-[opacity,display,overlay] backdrop:transition-discrete backdrop:duration-300 starting:open:scale-[0.97] starting:open:opacity-0 starting:open:backdrop:opacity-0 not-open:scale-[0.97] not-open:opacity-0 not-open:backdrop:opacity-0"
    >
      <h2 id="disclaimer-title" className="text-[19px] leading-tight font-semibold tracking-[-0.015em]">
        Curated by AI
      </h2>
      <p className="mt-2 text-[15px] leading-[1.55] text-pretty text-zinc-600">
        Each day&rsquo;s pick, headline and summary is chosen and written by AI from what was trending on X. Some of it
        may be upsetting or controversial, and details can be wrong.
      </p>
      <form method="dialog" className="mt-5">
        <button
          type="submit"
          className="h-10 w-full rounded-full bg-zinc-950 text-[15px] font-medium text-white transition-[scale,background-color] duration-200 ease-out hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 active:scale-[0.98]"
        >
          Got it
        </button>
      </form>
    </dialog>
  );
}
