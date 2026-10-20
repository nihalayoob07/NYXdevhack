"use client";
import { useSaved } from "@/lib/store";
import { Console } from "./Console";
import { Setup } from "./Setup";

// No trip on this device yet: set one up. Otherwise: watch it.
export function App() {
  const saved = useSaved();
  if (saved === undefined) return <div className="mx-auto mt-16 h-96 max-w-7xl animate-pulse rounded-[22px] bg-bg/60" aria-label="Loading" />;
  if (!saved) return <Setup />;
  const key = saved.trip.bookings.map((b) => `${b.id}${b.dep ?? b.at ?? ""}`).join();
  return <Console key={key} saved={saved} />;
}
