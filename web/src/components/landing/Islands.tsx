"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useInView, useScroll, useTransform, type MotionValue } from "motion/react";
import { DominoChain, FlipText } from "@/components/DominoChain";
import { dur, findAffected, fmt, parseConstraints, rankPlans, rupees, type ChainNode } from "@/lib/engine";
import { getScenario, trip } from "@/lib/world";

const ease = [0.16, 1, 0.3, 1] as const;

export function Reveal({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.7, delay, ease }}
    >
      {children}
    </motion.div>
  );
}

// Hero: the real chain component, looping planned -> broken -> repaired.
export function HeroChain() {
  const s = getScenario("inbound-delay")!;
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.3 });
  const [phase, setPhase] = useState(0);
  const best = useMemo(() => rankPlans(trip, s, parseConstraints(trip.defaultConstraints))[0], [s]);
  const frames = useMemo(() => {
    const event = trip.bookings.at(-1)!;
    const repaired: ChainNode[] = [
      ...best.steps.map((leg): ChainNode => ({ leg, status: leg.isNew ? "repaired" : "ok", reason: "" })),
      { leg: event, status: "ok", reason: "" },
    ];
    return [
      { nodes: findAffected(trip, null), caption: "Planned: flight, train, hotel, wedding. Each link depends on the one before." },
      { nodes: findAffected(trip, s), caption: `The inbound aircraft is ${s.effects[0].delay! - 2} min late. One delay, three more links break.` },
      { nodes: repaired, caption: `Repaired: ${best.plan.label.toLowerCase()}, ${rupees(best.extraCost)} extra, arriving ${fmt(best.arrival)}.` },
    ];
  }, [s, best]);

  useEffect(() => {
    if (!inView) return;
    const t = setInterval(() => setPhase((p) => (p + 1) % frames.length), phase === 1 ? 4200 : 3400);
    return () => clearInterval(t);
  }, [inView, phase, frames.length]);

  return (
    <div ref={ref} className="rounded-3xl border border-line bg-surface/60 p-4 md:p-5">
      <DominoChain nodes={frames[phase].nodes} compact label="Example trip" />
      <p className="mt-4 min-h-[3em] text-sm leading-relaxed text-muted md:min-h-0">
        <FlipText key={phase} text={frames[phase].caption} wrap />
      </p>
    </div>
  );
}

function Word({ word, progress, range, hot }: { word: string; progress: MotionValue<number>; range: [number, number]; hot: boolean }) {
  const opacity = useTransform(progress, range, [0.16, 1]);
  return (
    <motion.span style={{ opacity, color: hot ? "var(--bad)" : undefined }} className="inline-block pr-[0.25em]">
      {word}
    </motion.span>
  );
}

// Scroll-linked: the sentence lights up as you read it, consequences in red.
export function RippleStatement() {
  const ref = useRef<HTMLParagraphElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.85", "end 0.45"] });
  const parts: [string, boolean][] = [
    ["A two-hour delay is never one problem. It is", false],
    ["a missed train,", true],
    ["a hotel that gives your room away,", true],
    ["and a wedding you watch on a video call.", true],
  ];
  const words = parts.flatMap(([t, hot]) => t.split(" ").map((w) => [w, hot] as const));
  return (
    <p ref={ref} className="max-w-[22ch] text-4xl font-semibold leading-[1.1] tracking-tight md:text-6xl">
      {words.map(([w, hot], i) => (
        <Word key={i} word={w} hot={hot} progress={scrollYProgress} range={[i / words.length, (i + 1) / words.length]} />
      ))}
    </p>
  );
}

export function SignalFeed() {
  const s = getScenario("inbound-delay")!;
  const lead = s.airlineAnnouncesAt! - s.detectedAt;
  const rows = [
    { t: "10:42", who: "Flight tracker", text: "VT-IZK still on the ground in Bengaluru, 118 min behind schedule.", color: "var(--muted)" },
    { t: fmt(s.detectedAt).slice(4), who: "Domino", text: "Your 15:40 will leave late. Plan B is ready, 4 seats left.", color: "var(--accent-ink)" },
    { t: fmt(s.airlineAnnouncesAt!).slice(4), who: "IndiGo", text: "6E 2417 is delayed. We regret the inconvenience.", color: "var(--muted)" },
  ];
  return (
    <div className="rounded-3xl border border-line bg-surface p-5 md:p-6">
      <ol className="space-y-4">
        {rows.map((r, i) => (
          <motion.li
            key={r.t}
            className="grid grid-cols-[56px_1fr] gap-3"
            initial={{ opacity: 0, x: 16 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ duration: 0.5, delay: i * 0.45, ease }}
          >
            <span className="font-mono text-sm tabular text-muted">{r.t}</span>
            <span>
              <span className="block text-xs font-medium" style={{ color: r.color }}>
                {r.who}
              </span>
              <span className="text-sm leading-relaxed">{r.text}</span>
            </span>
          </motion.li>
        ))}
      </ol>
      <motion.div
        className="mt-6 flex items-baseline gap-3 border-t border-line pt-5"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ delay: 1.5 }}
      >
        <span className="font-mono text-5xl font-semibold tabular text-accent-ink">{lead} min</span>
        <span className="text-sm text-muted">head start on 180 people chasing the same seats</span>
      </motion.div>
    </div>
  );
}

export function ConstraintParse() {
  const c = parseConstraints(trip.defaultConstraints);
  const words = trip.defaultConstraints.split(" ");
  const chips: [string, "Hard" | "Soft"][] = [
    [`Arrive by ${fmt(c.deadline!)}`, "Hard"],
    [`Max ${rupees(c.budget!)} extra`, "Hard"],
    ["No overnight buses", "Hard"],
    [`Waits under ${dur(c.maxLayover!)}`, "Hard"],
    ["Fewer changes for mum", "Soft"],
  ];
  return (
    <motion.div initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.5 }} className="mx-auto max-w-3xl">
      <p className="rounded-3xl border border-line bg-surface p-5 text-lg leading-relaxed md:p-7 md:text-2xl">
        {words.map((w, i) => (
          <motion.span key={i} variants={{ hidden: { opacity: 0.12 }, show: { opacity: 1, transition: { delay: i * 0.05 } } }}>
            {w}{" "}
          </motion.span>
        ))}
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {chips.map(([t, kind], i) => (
          <motion.span
            key={t}
            variants={{ hidden: { opacity: 0, y: 12, scale: 0.9 }, show: { opacity: 1, y: 0, scale: 1, transition: { delay: words.length * 0.05 + i * 0.12, type: "spring", stiffness: 260, damping: 20 } } }}
            className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-2 text-sm"
          >
            <span className="text-[11px] text-muted">{kind}</span>
            {t}
          </motion.span>
        ))}
      </div>
    </motion.div>
  );
}
