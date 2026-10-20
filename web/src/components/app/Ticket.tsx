"use client";
import { motion } from "motion/react";
import { AirplaneTilt, Bed, Bus, Car, Confetti, Train, type Icon } from "@phosphor-icons/react";
import { clock, fmt, type Leg, type Mode } from "@/lib/engine";

export const ICON: Record<Mode, Icon> = { flight: AirplaneTilt, train: Train, bus: Bus, cab: Car, hotel: Bed, event: Confetti };

// "Delhi DEL" -> DEL, "KSR Bengaluru" -> KSR, "Mysuru Jn" -> MYS
const code = (place?: string) => place?.match(/\b[A-Z]{3}\b/)?.[0] ?? place?.slice(0, 3).toUpperCase() ?? "";

export function line(l: Leg) {
  if (l.mode === "event") return `${fmt(l.at!)} · ${l.to?.split(", ").at(-1)}`;
  if (l.mode === "hotel") return l.checkInBy === undefined ? `${l.to} · 24h front desk` : `Check in by ${l.checkInBy % 1440 ? clock(l.checkInBy) : "00:00"}`;
  return `${code(l.from)} ${clock(l.dep!)} → ${code(l.to)} ${clock(l.arr!)}`;
}

function stub(l: Leg): [string, string] {
  if (l.mode === "event") return [fmt(l.at!).slice(0, 3).toUpperCase(), clock(l.at!)];
  if (l.mode === "hotel") return ["1", "NIGHT"];
  if (!l.ref) return [l.mode.toUpperCase(), ""];
  const [k, v] = l.ref.split(" ");
  return [k.toUpperCase(), v.length > 7 ? v.slice(-6) : v];
}

export type Look = "plain" | "late" | "broken" | "risk" | "kept" | "fresh";
const INK: Record<Look, string> = { plain: "", late: "var(--warn)", broken: "var(--stop)", risk: "var(--faded)", kept: "var(--go)", fresh: "var(--go)" };

export function Ticket({ leg, look = "plain", stamp, sub, i = 0 }: { leg: Leg; look?: Look; stamp?: string; sub?: string; i?: number }) {
  const Ico = ICON[leg.mode];
  const [a, b] = stub(leg);
  return (
    <motion.li
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: look === "risk" ? 0.55 : 1, y: 0 }}
      transition={{ duration: 0.45, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
      className={`tk list-none ${look === "fresh" ? "tk-print" : ""}`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2.5 text-xs typed">
        <Ico size={22} weight="duotone" aria-hidden className="shrink-0" />
        <div className="min-w-0">
          <b className="block truncate text-sm">{leg.title.split(", ")[0]}</b>
          <span className="block truncate">{sub ?? line(leg)}</span>
        </div>
      </div>
      <div className="tk-stub grid place-items-center p-1 text-center text-[10px] leading-tight opacity-75 typed">
        <span>
          {a}
          <br />
          {b}
        </span>
      </div>
      {stamp && (
        <span className="stamp typed" style={{ color: INK[look] }}>
          {stamp}
        </span>
      )}
    </motion.li>
  );
}
