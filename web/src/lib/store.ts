"use client";
import { useSyncExternalStore } from "react";
import type { Trip } from "./engine";

// The traveller's trip lives on their device. No account, no server copy.
const KEY = "domino.trip.v1";
export interface Saved {
  trip: Trip;
  example?: boolean; // the built-in example trip, which also has the curated disruptions
}

const listeners = new Set<() => void>();
let cache: { raw: string | null; value: Saved | null } = { raw: null, value: null };

function read(): Saved | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {}
  if (raw !== cache.raw) {
    let value: Saved | null = null;
    try {
      value = raw ? (JSON.parse(raw) as Saved) : null;
    } catch {}
    cache = { raw, value };
  }
  return cache.value;
}

export function saveTrip(s: Saved | null) {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s));
    else localStorage.removeItem(KEY);
  } catch {}
  listeners.forEach((l) => l());
}

// undefined while rendering on the server, then the saved trip (or null) in the browser.
export function useSaved(): Saved | null | undefined {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      window.addEventListener("storage", cb);
      return () => {
        listeners.delete(cb);
        window.removeEventListener("storage", cb);
      };
    },
    read,
    () => undefined,
  );
}
