"use client";

import { useCallback, useSyncExternalStore } from "react";
import { todayPacific } from "./dates";
import { PLATFORMS, type Platform } from "./schema";

const noopSubscribe = () => () => {};

/** Today in Pacific time, or null during prerender so server and client markup match. */
export function useToday(): string | null {
  return useSyncExternalStore(noopSubscribe, todayPacific, () => null);
}

const URL_CHANGE_EVENT = "capsule:urlchange";

function subscribeToUrl(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  window.addEventListener(URL_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(URL_CHANGE_EVENT, onChange);
  };
}

function readPlatformParam(): Platform | null {
  const value = new URLSearchParams(window.location.search).get("platform");
  return PLATFORMS.includes(value as Platform) ? (value as Platform) : null;
}

/** Platform filter mirrored into `?platform=` so filtered views are shareable. */
export function usePlatformFilter(): [Platform | null, (next: Platform | null) => void] {
  const platform = useSyncExternalStore(subscribeToUrl, readPlatformParam, () => null);
  const setPlatform = useCallback((next: Platform | null) => {
    const url = new URL(window.location.href);
    if (next) url.searchParams.set("platform", next);
    else url.searchParams.delete("platform");
    window.history.replaceState(window.history.state, "", url);
    window.dispatchEvent(new Event(URL_CHANGE_EVENT));
  }, []);
  return [platform, setPlatform];
}
