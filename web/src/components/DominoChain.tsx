"use client";
import { useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AirplaneTilt, Bed, Bus, Car, Confetti, Train, type Icon } from "@phosphor-icons/react";
import { clock, fmt, type ChainNode, type Mode, type Status } from "@/lib/engine";

const ICON: Record<Mode, Icon> = { flight: AirplaneTilt, train: Train, bus: Bus, cab: Car, hotel: Bed, event: Confetti };

export const STATUS: Record<Status, { label: string; color: string; tipped: boolean }> = {
  ok: { label: "On track", color: "var(--muted)", tipped: false },
  delayed: { label: "Delayed", color: "var(--late)", tipped: false },
  cancelled: { label: "Cancelled", color: "var(--bad)", tipped: true },
  broken: { label: "Broken", color: "var(--bad)", tipped: true },
  "at-risk": { label: "At risk", color: "var(--bad)", tipped: true },
  repaired: { label: "New", color: "var(--good)", tipped: false },
};

const STAGGER = 0.32; // seconds between dominoes falling

// Whether the chain is laid out in a row; wide stacked tiles need a much smaller tilt.
function useRow(query: string) {
  return useSyncExternalStore(
    (cb) => {
      const m = matchMedia(query);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => matchMedia(query).matches,
    () => true,
  );
}

// Split-flap style: the old text flips away, the new one flips in.
export function FlipText({ text, className = "", wrap }: { text: string; className?: string; wrap?: boolean }) {
  return (
    <span className={`inline-grid overflow-hidden align-bottom [perspective:300px] ${wrap ? "" : "whitespace-nowrap"} ${className}`}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={text}
          className="col-start-1 row-start-1"
          initial={{ rotateX: -90, opacity: 0 }}
          animate={{ rotateX: 0, opacity: 1 }}
          exit={{ rotateX: 90, opacity: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
          {text}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function when(n: ChainNode) {
  const l = n.leg;
  if (l.mode === "event") return fmt(l.at!);
  if (l.mode === "hotel") return l.checkInBy === undefined ? "24h desk" : `Desk till ${l.checkInBy % 1440 ? clock(l.checkInBy) : "midnight"}`;
  return `${clock(l.dep!)} → ${clock(l.arr!)}`;
}
const short = (place?: string) => place?.replace(/ (Jn|Bengaluru)$/, "").replace(/^(KSR) .*/, "$1") ?? "";

function Tile({ n, i, compact, tilt }: { n: ChainNode; i: number; compact?: boolean; tilt: number }) {
  const st = STATUS[n.status];
  const Ico = ICON[n.leg.mode];
  const tint = n.status === "ok" ? "var(--surface)" : `color-mix(in oklab, ${st.color} 9%, var(--surface))`;
  return (
    <motion.li
      layout
      className="relative flex-1 min-w-0 list-none"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.div
        className="h-full rounded-2xl border p-4 origin-bottom-right"
        style={{ borderColor: n.status === "ok" ? "var(--line)" : st.color, borderStyle: n.status === "at-risk" ? "dashed" : "solid" }}
        animate={{
          rotate: st.tipped ? tilt : 0,
          y: st.tipped ? 4 : 0,
          backgroundColor: tint,
          x: n.status === "delayed" ? [0, -3, 3, -2, 0] : 0,
        }}
        transition={{
          rotate: { type: "spring", stiffness: 260, damping: 14, delay: st.tipped ? i * STAGGER : 0 },
          y: { type: "spring", stiffness: 260, damping: 14, delay: st.tipped ? i * STAGGER : 0 },
          backgroundColor: { duration: 0.4, delay: st.tipped ? i * STAGGER : 0 },
          x: { duration: 0.5 },
        }}
      >
        <div className="flex items-center justify-between gap-2">
          <Ico size={compact ? 18 : 22} weight="duotone" style={{ color: n.status === "ok" ? "var(--text)" : st.color }} aria-hidden />
          <span className="rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ color: st.color, background: `color-mix(in oklab, ${st.color} 14%, transparent)` }}>
            <FlipText text={st.label} />
          </span>
        </div>
        <p className={`mt-3 font-medium leading-snug ${compact ? "text-sm" : ""}`}>{n.leg.title}</p>
        {n.leg.from && (
          <p className="mt-0.5 truncate text-xs text-muted">
            {short(n.leg.from)} → {short(n.leg.to)}
          </p>
        )}
        <p className="mt-2 font-mono text-sm tabular">
          <FlipText text={when(n)} />
        </p>
        {!compact && (
          <p className="mt-2 text-xs leading-relaxed text-muted min-h-[2.5em]">
            <FlipText text={n.reason} wrap />
          </p>
        )}
      </motion.div>
    </motion.li>
  );
}

function Link({ from, to, i, wide }: { from: ChainNode; to: ChainNode; i: number; wide?: boolean }) {
  const shock = STATUS[to.status].tipped && !STATUS[from.status].tipped;
  const color = STATUS[to.status].tipped ? "var(--bad)" : to.status === "repaired" || from.status === "repaired" ? "var(--good)" : "var(--line)";
  return (
    <li aria-hidden className={`relative flex shrink-0 items-center justify-center h-5 list-none ${wide ? "xl:w-6 xl:h-auto" : "md:w-6 md:h-auto"}`}>
      <motion.span className={`block h-full w-0.5 rounded-full ${wide ? "xl:h-0.5 xl:w-full" : "md:h-0.5 md:w-full"}`} animate={{ backgroundColor: color }} transition={{ delay: (i + 1) * STAGGER }} />
      {shock && (
        <motion.span
          key={to.status}
          className="absolute size-2.5 rounded-full bg-bad"
          initial={{ scale: 0.4, opacity: 1 }}
          animate={{ scale: [0.4, 2.4], opacity: [1, 0] }}
          transition={{ duration: 0.9, delay: i * STAGGER, repeat: 2, repeatDelay: 0.4 }}
        />
      )}
    </li>
  );
}

// wide: only lay out in a row from xl up, for narrow containers like the demo's main column.
export function DominoChain({ nodes, compact, label, wide }: { nodes: ChainNode[]; compact?: boolean; label: string; wide?: boolean }) {
  const row = useRow(wide ? "(min-width: 1280px)" : "(min-width: 768px)");
  return (
    <ol aria-label={label} className={`flex flex-col ${wide ? "xl:flex-row xl:items-stretch" : "md:flex-row md:items-stretch"}`}>
      {nodes.map((n, i) => [
        i > 0 && <Link key={`l-${n.leg.id}`} from={nodes[i - 1]} to={n} i={i} wide={wide} />,
        <Tile key={n.leg.id} n={n} i={i} compact={compact} tilt={row ? 5 : 1.2} />,
      ])}
    </ol>
  );
}
