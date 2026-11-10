"use client";

import { Check, ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { PLATFORM_META } from "@/lib/platforms";
import { type Platform } from "@/lib/schema";
import { PlatformLogo } from "./PlatformLogo";

const MENU_ORDER: Platform[] = ["x", "instagram", "tiktok", "reddit", "youtube"];

/** The logo in "Trending on [logo]": opens a menu of platforms, the ones without data yet marked as coming. */
export function PlatformSwitcher({
  value,
  available,
  onChange,
}: {
  value: Platform;
  available: ReadonlySet<Platform>;
  onChange: (p: Platform) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const logoRef = useRef<HTMLSpanElement>(null);
  const menuId = useId();

  // Played from script rather than CSS: the router hides and re-shows visited pages, which
  // would restart a CSS animation on every return.
  const choose = (p: Platform) => {
    setOpen(false);
    buttonRef.current?.focus();
    if (p === value) return;
    onChange(p);
    logoRef.current?.animate(
      [
        { opacity: 0, transform: "translateY(-4px) scale(0.97)" },
        { opacity: 1, transform: "none" },
      ],
      { duration: 360, easing: "cubic-bezier(0.25, 0.8, 0.25, 1)" },
    );
  };

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative inline-flex">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`${PLATFORM_META[value].label}. Change platform`}
        onClick={() => setOpen((o) => !o)}
        className="group -my-1 inline-flex items-center gap-1 rounded-[0.32em] py-1 pr-1 pl-[0.2em] transition-[background-color,scale] duration-150 ease-out hover:bg-black/[0.05] active:scale-[0.97] aria-expanded:bg-black/[0.06] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
      >
        <span ref={logoRef} className="grid size-[0.86em] place-items-center">
          <PlatformLogo platform={value} className="size-full" />
        </span>
        <ChevronDown
          aria-hidden
          strokeWidth={2.25}
          className="size-[0.5em] text-zinc-400 transition-transform duration-200 ease-out group-aria-expanded:rotate-180"
        />
      </button>

      <div
        id={menuId}
        role="menu"
        data-open={open || undefined}
        inert={!open}
        className="pointer-events-none absolute top-[calc(100%+10px)] left-1/2 z-40 w-56 -translate-x-1/2 origin-top scale-[0.96] rounded-2xl bg-white p-1.5 text-[14px] font-normal tracking-normal opacity-0 shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_12px_32px_-8px_rgb(0_0_0/0.22)] transition-[opacity,scale] duration-150 ease-out data-open:pointer-events-auto data-open:scale-100 data-open:opacity-100"
      >
        <p className="px-2.5 pt-1.5 pb-1 text-[12px] text-zinc-400">Trending on</p>
        {MENU_ORDER.map((p) => {
          const live = available.has(p);
          const selected = p === value;
          return (
            <button
              key={p}
              type="button"
              role="menuitemradio"
              aria-checked={selected}
              disabled={!live}
              onClick={() => choose(p)}
              className="flex h-10 w-full items-center gap-3 rounded-[10px] px-2.5 text-left text-zinc-900 transition-colors duration-100 hover:bg-zinc-100 disabled:hover:bg-transparent"
            >
              <PlatformLogo platform={p} className={`size-[18px] shrink-0 ${live ? "" : "opacity-40 grayscale"}`} />
              <span className={`flex-1 ${live ? "" : "text-zinc-400"}`}>{PLATFORM_META[p].label}</span>
              {selected ? (
                <Check aria-hidden className="size-4 text-zinc-900" strokeWidth={2.25} />
              ) : (
                !live && <span className="text-[12px] text-zinc-400">Soon</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
