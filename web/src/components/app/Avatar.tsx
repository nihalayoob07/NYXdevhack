"use client";
import { useSaved } from "@/lib/store";

export function Avatar() {
  const name = useSaved()?.trip.traveller;
  if (!name) return null;
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  return (
    <span className="ml-2 grid size-[34px] place-items-center rounded-full bg-text text-xs font-bold text-bg" aria-label={name}>
      {initials}
    </span>
  );
}
