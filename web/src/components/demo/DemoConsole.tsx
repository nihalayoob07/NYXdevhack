"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { AirplaneTilt, ArrowCounterClockwise, Bed, Lightning, Robot, Train, WifiSlash, XCircle, type Icon } from "@phosphor-icons/react";
import { DominoChain, FlipText } from "@/components/DominoChain";
import { clock, draftActions, dur, findAffected, fmt, parseConstraints, rankPlans, rupees, type ChainNode, type Constraints, type Evaluated } from "@/lib/engine";
import { scenarios, trip } from "@/lib/world";
import { useAgent } from "./useAgent";
import { Plans, type PlanRow } from "./Plans";
import { Actions } from "./Actions";

const CHAOS_ICON: Record<string, Icon> = { "inbound-delay": AirplaneTilt, "flight-cancelled": XCircle, "train-cancelled": Train, "hotel-overbooked": Bed };
const IDLE_CLOCK = 600;
const ease = [0.16, 1, 0.3, 1] as const;

function repairedChain(e: Evaluated): ChainNode[] {
  const event = trip.bookings.find((b) => b.mode === "event")!;
  return [
    ...e.steps.map((leg): ChainNode => ({ leg, status: leg.isNew ? "repaired" : "ok", reason: leg.isNew ? "Newly booked" : "Kept as is" })),
    { leg: event, status: "ok", reason: e.buffer !== null ? `You arrive ${dur(e.buffer)} early` : "On track" },
  ];
}

function Chips({ c }: { c: Constraints }) {
  const hard = [
    c.deadline !== null && `Arrive by ${fmt(c.deadline)}`,
    c.budget !== null && `Max ${rupees(c.budget)} extra`,
    c.noOvernightBus && "No overnight buses",
    c.maxLayover !== null && `Waits under ${dur(c.maxLayover)}`,
  ].filter(Boolean) as string[];
  const soft = [c.companion && `Comfort for ${c.companion}: fewer changes, no late nights`].filter(Boolean) as string[];
  return (
    <div className="mt-3 space-y-2">
      {[
        ["Hard", hard, "var(--text)"],
        ["Soft", soft, "var(--muted)"],
      ].map(([k, list, color]) =>
        (list as string[]).length ? (
          <div key={k as string} className="flex flex-wrap items-center gap-1.5">
            <span className="w-9 text-[11px] text-muted">{k as string}</span>
            {(list as string[]).map((t, i) => (
              <motion.span
                key={t}
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.07, type: "spring", stiffness: 300, damping: 22 }}
                className="rounded-full border border-line bg-surface px-2.5 py-1 text-xs"
                style={{ color: color as string }}
              >
                {t}
              </motion.span>
            ))}
          </div>
        ) : null,
      )}
    </div>
  );
}

function Panel({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-line bg-surface/60 p-4 md:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-medium tracking-tight">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function DemoConsole() {
  const agent = useAgent();
  const [scenarioId, setScenarioId] = useState<string | null>(null);
  const [text, setText] = useState(trip.defaultConstraints);
  const [selected, setSelected] = useState<string | null>(null);
  const [approved, setApproved] = useState(false);
  const [airlineSaid, setAirlineSaid] = useState(false);
  const repairedRef = useRef<HTMLDivElement>(null);
  const s = scenarios.find((x) => x.id === scenarioId) ?? null;

  useEffect(() => {
    if (approved) repairedRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [approved]);

  // Demo time is compressed: the "airline" announces 8s after Domino's alert.
  useEffect(() => {
    if (!s?.airlineAnnouncesAt) return;
    const t = setTimeout(() => setAirlineSaid(true), 8000);
    return () => clearTimeout(t);
  }, [s]);

  const nodes = useMemo(() => findAffected(trip, s), [s]);
  const rows: PlanRow[] = useMemo(() => {
    if (!s || !agent.result) return [];
    const ranked = rankPlans(trip, s, agent.constraints ?? parseConstraints(text));
    const said = new Map(agent.result.ranked.map((r) => [r.planId, r]));
    return ranked.map((e) => ({ e, verdict: said.get(e.plan.id)?.verdict ?? "backup", explanation: said.get(e.plan.id)?.explanation ?? "" }));
  }, [s, agent.result, agent.constraints, text]);

  const pickedId = selected ?? rows[0]?.e.plan.id ?? null; // default to the top-ranked plan
  const chosen = rows.find((r) => r.e.plan.id === pickedId)?.e ?? null;
  const actions = useMemo(() => (s && chosen && approved ? draftActions(trip, s, chosen) : []), [s, chosen, approved]);

  const trigger = (id: string) => {
    setScenarioId(id);
    setSelected(null);
    setApproved(false);
    setAirlineSaid(false);
    agent.run(id, text);
  };
  const reset = () => {
    agent.reset();
    setScenarioId(null);
    setSelected(null);
    setApproved(false);
    setAirlineSaid(false);
  };

  const original = trip.bookings.filter((b) => b.mode !== "event");
  const plannedArrival = original.filter((b) => b.arr !== undefined).at(-1)!.arr!;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-8 md:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{trip.traveller}&apos;s trip to Mysuru</h1>
          <p className="mt-1 text-muted">
            {trip.date}, with {trip.companion}, for the wedding muhurtham at 09:00 Tuesday.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <p className="rounded-full border border-line bg-surface px-3 py-1.5 font-mono text-sm tabular" aria-live="polite">
            <span className="font-sans text-muted">Now </span>
            <FlipText text={fmt(s?.detectedAt ?? IDLE_CLOCK)} />
          </p>
          {s && (
            <button type="button" onClick={reset} className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-sm transition active:scale-[0.97]">
              <ArrowCounterClockwise size={15} aria-hidden /> Reset
            </button>
          )}
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          <Panel
            title="Trip chain"
            aside={<span className="text-xs text-muted">{s ? `${nodes.filter((n) => n.status !== "ok").length} of ${nodes.length} links affected` : "All links on track"}</span>}
          >
            <DominoChain nodes={nodes} label="Original trip" wide />
            {!s && <p className="mt-4 text-sm text-muted">Everything is on time. Pick a disruption in the chaos panel to break a link and watch Domino repair the chain.</p>}
          </Panel>

          <AnimatePresence>
            {s && (
              <motion.section
                key={s.id}
                initial={{ opacity: 0, y: -10, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.5, ease }}
                className="overflow-hidden rounded-3xl border border-bad/40 bg-[color-mix(in_oklab,var(--bad)_7%,var(--surface))]"
                role="alert"
              >
                <div className="p-4 md:p-6">
                  <div className="flex flex-wrap items-center gap-2">
                    <Lightning size={18} weight="fill" className="text-bad" aria-hidden />
                    <p className="font-medium">{s.headline}</p>
                    <span className="font-mono text-xs text-muted">detected {clock(s.detectedAt)}</span>
                  </div>
                  <ul className="mt-3 space-y-1.5 text-sm text-muted">
                    {s.signals.map((sig, i) => (
                      <motion.li key={sig} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.15 }}>
                        {sig}
                      </motion.li>
                    ))}
                  </ul>
                  {s.airlineAnnouncesAt && (
                    <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl bg-surface px-4 py-3 text-sm">
                      <p>
                        <span className="text-muted">IndiGo app says </span>
                        <span className="font-mono font-medium" style={{ color: airlineSaid ? "var(--late)" : "var(--good)" }}>
                          <FlipText text={airlineSaid ? "DELAYED 2H" : "ON TIME"} />
                        </span>
                      </p>
                      <AnimatePresence>
                        {airlineSaid && (
                          <motion.p initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="font-medium">
                            Domino warned you {s.airlineAnnouncesAt - s.detectedAt} min earlier.
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </div>
              </motion.section>
            )}
          </AnimatePresence>

          {s && (
            <Panel
              title="Agent"
              aside={
                agent.mode && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-xs text-muted">
                    {agent.mode === "ai" ? <Robot size={14} aria-hidden /> : <WifiSlash size={14} aria-hidden />}
                    {agent.mode === "ai" ? "Live AI (Groq)" : "Built-in planner (no API key)"}
                  </span>
                )
              }
            >
              <ol className="space-y-2" aria-live="polite">
                {agent.steps.map((st, i) => (
                  <motion.li key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease }} className="grid grid-cols-[150px_1fr] gap-3 text-sm max-sm:grid-cols-1 max-sm:gap-0.5">
                    <span className="font-mono text-xs leading-5 text-accent-ink">{st.tool}</span>
                    <span className="leading-5 text-text/90">{st.text}</span>
                  </motion.li>
                ))}
                {agent.running && (
                  <li className="grid grid-cols-[150px_1fr] gap-3 max-sm:grid-cols-1" aria-label="Agent is working">
                    <span className="h-4 w-24 animate-pulse rounded bg-surface-2" />
                    <span className="h-4 w-3/4 animate-pulse rounded bg-surface-2" />
                  </li>
                )}
              </ol>
              {agent.error && <p className="mt-3 text-sm text-bad">{agent.error}. Press Reset and try again.</p>}
            </Panel>
          )}

          <AnimatePresence mode="wait">
            {rows.length > 0 && !approved && (
              <motion.div key="plans" exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.3 }}>
                <Panel title="Recovery options">
                  {agent.result && <p className="mb-4 text-sm text-muted">{agent.result.summary}</p>}
                  <Plans rows={rows} selected={pickedId} onSelect={setSelected} />
                  <div className="mt-5 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      disabled={!chosen}
                      onClick={() => setApproved(true)}
                      className="rounded-full bg-accent px-5 py-2.5 font-medium text-on-accent transition active:scale-[0.97] disabled:opacity-40"
                    >
                      Approve plan
                    </button>
                    <p className="text-xs text-muted">Times, prices and limits are checked by code. The AI only explains the trade-offs.</p>
                  </div>
                </Panel>
              </motion.div>
            )}
            {approved && chosen && (
              <motion.div key="repaired" ref={repairedRef} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, ease }} className="scroll-mt-24 space-y-6">
                <Panel
                  title="Repaired trip"
                  aside={
                    <button type="button" onClick={() => setApproved(false)} className="text-xs text-muted underline-offset-4 hover:underline">
                      Change plan
                    </button>
                  }
                >
                  <DominoChain nodes={repairedChain(chosen)} label="Repaired trip" wide />
                  <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-line pt-4 font-mono tabular md:grid-cols-4">
                    {[
                      ["Arrive Mysuru", fmt(chosen.arrival), chosen.arrival > plannedArrival ? `${dur(chosen.arrival - plannedArrival)} later than planned` : "as planned"],
                      ["Extra cost", rupees(chosen.extraCost), "after refunds"],
                      ["Changes", String(chosen.changes), "new bookings"],
                      ["Before muhurtham", chosen.buffer !== null ? dur(chosen.buffer) : "n/a", "spare time"],
                    ].map(([k, v, sub], i) => (
                      <motion.div key={k} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 + i * 0.08 }}>
                        <dt className="font-sans text-xs text-muted">{k}</dt>
                        <dd className="mt-1 text-lg">{v}</dd>
                        <dd className="font-sans text-xs text-muted">{sub}</dd>
                      </motion.div>
                    ))}
                  </dl>
                </Panel>
                <Panel title="Finished actions, ready to send">
                  <Actions key={chosen.plan.id} actions={actions} />
                </Panel>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          <Panel title="Chaos panel">
            <div className="grid gap-2">
              {scenarios.map((sc) => {
                const Ico = CHAOS_ICON[sc.id] ?? Lightning;
                const active = sc.id === scenarioId;
                return (
                  <motion.button
                    key={sc.id}
                    type="button"
                    whileTap={{ scale: 0.98 }}
                    disabled={agent.running}
                    onClick={() => trigger(sc.id)}
                    className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition-colors disabled:opacity-50 ${active ? "border-bad/60 bg-[color-mix(in_oklab,var(--bad)_8%,var(--surface))]" : "border-line bg-surface hover:border-muted/50"}`}
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2">
                      <Ico size={18} aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{sc.chaos}</span>
                      <span className="block truncate text-xs text-muted">{sc.airlineAnnouncesAt ? "Predicted before the airline says so" : sc.headline}</span>
                    </span>
                  </motion.button>
                );
              })}
            </div>
          </Panel>

          <Panel title="Your limits">
            <label htmlFor="limits" className="text-xs text-muted">
              In your own words
            </label>
            <textarea
              id="limits"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              className="mt-1.5 w-full resize-none rounded-2xl border border-line bg-surface p-3 text-sm leading-relaxed text-text placeholder:text-muted focus:border-accent focus:outline-none"
            />
            {agent.constraints ? <Chips c={agent.constraints} /> : <p className="mt-2 text-xs text-muted">The agent turns this into hard and soft limits when a disruption hits.</p>}
          </Panel>

          <Link
            href={`/stranded?s=${scenarioId ?? "inbound-delay"}`}
            className="flex items-center justify-between rounded-3xl border border-line bg-surface/60 p-4 text-sm transition-colors hover:border-muted/50"
          >
            <span>
              <span className="block font-medium">Stranded mode</span>
              <span className="text-xs text-muted">The same recovery as a 1, 2, 3 chat</span>
            </span>
            <span aria-hidden>→</span>
          </Link>
        </aside>
      </div>
    </div>
  );
}
