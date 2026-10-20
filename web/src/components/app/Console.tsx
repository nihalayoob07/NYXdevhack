"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { AirplaneTilt, ArrowCounterClockwise, ArrowRight, Bed, Lightning, Robot, Train, Warning, WifiSlash, XCircle, type Icon } from "@phosphor-icons/react";
import { clock, draftActions, dur, findAffected, fmt, parseConstraints, rankPlans, rupees, type ChainNode, type Constraints } from "@/lib/engine";
import { scenarios, trip } from "@/lib/world";
import { FlipText } from "./FlipText";
import { Ticket, type Look } from "./Ticket";
import { useAgent } from "./useAgent";
import { Plans, type PlanRow } from "./Plans";
import { Actions } from "./Actions";

const CHAOS_ICON: Record<string, Icon> = { "inbound-delay": AirplaneTilt, "flight-cancelled": XCircle, "train-cancelled": Train, "hotel-overbooked": Bed };
const IDLE_CLOCK = 600;
const ease = [0.16, 1, 0.3, 1] as const;
const event = trip.bookings.find((b) => b.mode === "event")!;
const city = event.to!.split(", ").at(-1)!;
const companion = trip.companion.match(/, (\w+)/)?.[1] ?? trip.companion;
const NAME: Record<string, string> = { flight: "flight", train: "train", bus: "bus", cab: "cab", hotel: "hotel", event: "the muhurtham" };

// How each booking looks on the stack after a disruption.
function stamp(n: ChainNode, delay: number): [Look, string?] {
  if (n.status === "delayed") return ["late", `+${dur(delay).toUpperCase()} LATE`];
  if (n.status === "cancelled") return ["broken", "CANCELLED"];
  if (n.status === "broken") return ["broken", "MISSED"];
  if (n.status === "at-risk") return ["risk", "AT RISK"];
  return ["plain"];
}

function Chips({ c }: { c: Constraints }) {
  const hard = [
    c.deadline !== null && `By ${fmt(c.deadline)}`,
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
            <span className="typed w-9 text-[11px] text-muted">{k as string}</span>
            {(list as string[]).map((t, i) => (
              <motion.span
                key={t}
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.07, type: "spring", stiffness: 300, damping: 22 }}
                className="typed rounded border border-dashed border-[#b5a98f] bg-surface px-2.5 py-1 text-xs"
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

const Eyebrow = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <p className={`typed text-[11px] uppercase tracking-[0.14em] text-muted ${className}`}>{children}</p>
);

function Panel({ title, children, aside, className = "" }: { title: string; children: React.ReactNode; aside?: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-[22px] bg-bg p-4 shadow-[0_2px_0_#c9bfa9,0_30px_50px_-40px_rgb(60_40_20/0.55)] md:p-6 ${className}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Status({ bad, children }: { bad?: boolean; children: React.ReactNode }) {
  return (
    <span className="typed inline-flex items-center gap-2 rounded-full bg-surface px-3 py-1.5 text-xs font-semibold" style={{ color: bad ? "var(--bad)" : "var(--good)" }}>
      <span className="pulse" />
      {children}
    </span>
  );
}

export function Console() {
  const agent = useAgent();
  const [scenarioId, setScenarioId] = useState<string | null>(null);
  const [text, setText] = useState(trip.defaultConstraints);
  const [selected, setSelected] = useState<string | null>(null);
  const [approved, setApproved] = useState(false);
  const [airlineSaid, setAirlineSaid] = useState(false);
  const [notif, setNotif] = useState(false);
  const alertRef = useRef<HTMLDivElement>(null);
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

  // The disruption lands as a push notification first.
  useEffect(() => {
    if (!notif) return;
    const t = setTimeout(() => setNotif(false), 4500);
    return () => clearTimeout(t);
  }, [notif]);

  const nodes = useMemo(() => findAffected(trip, s), [s]);
  const rows: PlanRow[] = useMemo(() => {
    if (!s || !agent.result) return [];
    const ranked = rankPlans(trip, s, agent.constraints ?? parseConstraints(text));
    const said = new Map(agent.result.ranked.map((r) => [r.planId, r]));
    return ranked.map((e) => ({ e, verdict: said.get(e.plan.id)?.verdict ?? "backup", explanation: said.get(e.plan.id)?.explanation ?? "" }));
  }, [s, agent.result, agent.constraints, text]);

  const pickedId = selected ?? rows[0]?.e.plan.id ?? null; // default to the top-ranked plan
  const chosen = rows.find((r) => r.e.plan.id === pickedId)?.e ?? null;
  const actions = s && chosen && approved ? draftActions(trip, s, chosen) : [];

  const trigger = (id: string) => {
    setScenarioId(id);
    setSelected(null);
    setApproved(false);
    setAirlineSaid(false);
    setNotif(true);
    agent.run(id, text);
    setTimeout(() => alertRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };
  const reset = () => {
    agent.reset();
    setScenarioId(null);
    setSelected(null);
    setApproved(false);
    setAirlineSaid(false);
    setNotif(false);
  };

  const original = trip.bookings.filter((b) => b.mode !== "event");
  const plannedArrival = original.filter((b) => b.arr !== undefined).at(-1)!.arr!;
  const affected = nodes.filter((n) => n.status !== "ok").length;
  const hit = nodes.find((n) => n.status === "broken");
  const atRisk = nodes.filter((n) => n.status === "at-risk").map((n) => NAME[n.leg.mode]);
  const delayOf = (id: string) => s?.effects.find((x) => x.booking === id)?.delay ?? 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-8 md:py-10">
      <AnimatePresence>
        {notif && s && (
          <motion.button
            type="button"
            onClick={() => setNotif(false)}
            initial={{ y: -120, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -120, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 24 }}
            className="fixed right-4 top-4 z-40 flex w-[min(380px,calc(100vw-2rem))] gap-3 rounded-2xl bg-surface p-3.5 text-left shadow-[0_2px_0_var(--edge),0_20px_30px_-20px_rgb(60_40_20/0.5)]"
          >
            <span className="grid size-[38px] shrink-0 place-items-center rounded-lg bg-bad text-white">
              <Warning size={20} weight="bold" aria-hidden />
            </span>
            <span>
              <b className="flex justify-between text-sm">
                Domino <span className="text-xs font-normal text-muted">now</span>
              </b>
              <span className="mt-0.5 block text-[13px]">{s.headline}. I&apos;m already working on a fix.</span>
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow>
            {trip.date.replace(/ \d{4}$/, "")} · with {companion}
          </Eyebrow>
          <h1 className="mt-1.5 text-4xl font-bold leading-[1.05] md:text-5xl">Your trip to {city}</h1>
          <p className="mt-2 text-muted">
            {trip.traveller} and {trip.companion}, for {event.title} at {fmt(event.at!).replace("Tue", "Tuesday")}.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <p className="typed rounded-full bg-surface px-3 py-1.5 text-sm tabular shadow-[0_2px_0_var(--edge)]" aria-live="polite">
            <span className="text-muted">Now </span>
            <FlipText text={fmt(s?.detectedAt ?? IDLE_CLOCK)} />
          </p>
          {s && (
            <button type="button" onClick={reset} className="inline-flex items-center gap-1.5 rounded-full border-2 border-text px-3 py-1 text-sm font-semibold transition active:scale-[0.97]">
              <ArrowCounterClockwise size={15} aria-hidden /> Reset
            </button>
          )}
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          <Panel title="Your bookings" aside={s ? <Status bad>{`${affected} of ${nodes.length} affected`}</Status> : <Status>Watching {nodes.length} bookings · all on time</Status>}>
            <ol aria-label="Your bookings" className="grid gap-2">
              {nodes.map((n, i) => {
                const [look, st] = stamp(n, delayOf(n.leg.id));
                return <Ticket key={`${s?.id}-${n.leg.id}`} leg={n.leg} look={look} stamp={st} i={i} />;
              })}
            </ol>
            {!s && <p className="mt-4 text-sm text-muted">Everything is on time. Send a disruption from the panel to break a booking and watch Domino repair the trip.</p>}
          </Panel>

          <AnimatePresence>
            {s && (
              <motion.section
                ref={alertRef}
                key={s.id}
                initial={{ opacity: 0, y: -10, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.5, ease }}
                className="scroll-mt-6 overflow-hidden rounded-[22px] border-2 border-bad bg-surface"
                role="alert"
              >
                <div className="p-4 md:p-6">
                  <Eyebrow className="!text-bad">
                    Detected {clock(s.detectedAt)}
                    {s.airlineAnnouncesAt && ` · ${s.airlineAnnouncesAt - s.detectedAt} min before IndiGo`}
                  </Eyebrow>
                  <h2 className="mt-1.5 flex items-start gap-2 text-2xl font-bold md:text-3xl">
                    <Lightning size={24} weight="fill" className="mt-1 shrink-0 text-bad" aria-hidden />
                    {s.headline}
                  </h2>
                  <ul className="mt-3 space-y-1.5 text-sm text-muted">
                    {s.signals.map((sig, i) => (
                      <motion.li key={sig} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.15 }}>
                        {sig}
                      </motion.li>
                    ))}
                  </ul>
                  {(hit || atRisk.length > 0) && (
                    <p className="mt-3 text-sm font-semibold text-bad">
                      {hit && `${hit.reason}. `}
                      {atRisk.length > 0 && `${`Your ${atRisk.join(", ").replace(/, ([^,]+)$/, " and $1")}`.replace("Your the", "The")} ${atRisk.length > 1 ? "are" : "is"} at risk.`}
                    </p>
                  )}
                  {s.airlineAnnouncesAt && (
                    <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl bg-bg px-4 py-3 text-sm">
                      <p>
                        <span className="text-muted">IndiGo app says </span>
                        <span className="typed font-bold" style={{ color: airlineSaid ? "var(--late)" : "var(--good)" }}>
                          <FlipText text={airlineSaid ? "DELAYED 2H" : "ON TIME"} />
                        </span>
                      </p>
                      <AnimatePresence>
                        {airlineSaid && (
                          <motion.p initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="font-semibold">
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
                  <span className="typed inline-flex items-center gap-1.5 rounded-full bg-surface px-2.5 py-1 text-xs text-muted">
                    {agent.mode === "ai" ? <Robot size={14} aria-hidden /> : <WifiSlash size={14} aria-hidden />}
                    {agent.mode === "ai" ? "Live AI (Groq)" : "Built-in planner"}
                  </span>
                )
              }
            >
              <ol className="space-y-2" aria-live="polite">
                {agent.steps.map((st, i) => (
                  <motion.li key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease }} className="grid grid-cols-[160px_1fr] gap-3 text-sm max-sm:grid-cols-1 max-sm:gap-0.5">
                    <span className="typed text-xs leading-5 text-accent-ink">{st.tool}</span>
                    <span className="leading-5">{st.text}</span>
                  </motion.li>
                ))}
                {agent.running && (
                  <li className="grid grid-cols-[160px_1fr] gap-3 max-sm:grid-cols-1" aria-label="Agent is working">
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
                <Panel title="Here's how to fix it">
                  {agent.result && <p className="mb-4 text-sm text-muted">{agent.result.summary}</p>}
                  <Plans rows={rows} selected={pickedId} onSelect={setSelected} />
                  <div className="mt-5 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      disabled={!chosen}
                      onClick={() => setApproved(true)}
                      className="inline-flex items-center gap-2 rounded-[14px] bg-accent px-6 py-3.5 font-bold text-on-accent transition active:scale-[0.98] disabled:opacity-40"
                    >
                      Approve and book <ArrowRight size={18} weight="bold" aria-hidden />
                    </button>
                    <p className="text-xs text-muted">Times, prices and limits are checked by code. The AI only explains the trade-offs.</p>
                  </div>
                </Panel>
              </motion.div>
            )}
            {approved && chosen && (
              <motion.div key="repaired" ref={repairedRef} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, ease }} className="scroll-mt-6 space-y-6">
                <Panel
                  title="You're back on track"
                  aside={
                    <button type="button" onClick={() => setApproved(false)} className="text-xs font-semibold text-muted underline-offset-4 hover:underline">
                      Change plan
                    </button>
                  }
                >
                  <ol aria-label="Repaired trip" className="grid gap-2">
                    {chosen.steps.map((l, i) => (
                      <Ticket
                        key={l.id}
                        leg={l}
                        i={i}
                        look={l.isNew ? "fresh" : "kept"}
                        stamp={l.isNew ? "NEW" : "KEPT"}
                        sub={l.mode === "hotel" && chosen.lateCheckIn ? `Late check-in ${clock(chosen.arrival + (l.connectMin ?? 20))}` : undefined}
                      />
                    ))}
                    <Ticket leg={event} i={chosen.steps.length} look="kept" stamp="ON TIME" />
                  </ol>
                  <dl className="mt-5 grid grid-cols-2 gap-4 border-t-2 border-dashed border-line pt-4 md:grid-cols-4">
                    {[
                      [`Arrive ${city}`, fmt(chosen.arrival), chosen.arrival > plannedArrival ? `${dur(chosen.arrival - plannedArrival)} later than planned` : "as planned"],
                      [chosen.extraCost < 0 ? "You get back" : "Extra cost", rupees(Math.abs(chosen.extraCost)), "after refunds, for 2"],
                      ["Changes", String(chosen.changes), "new bookings"],
                      ["Before muhurtham", chosen.buffer !== null ? dur(chosen.buffer) : "n/a", "spare time"],
                    ].map(([k, v, sub], i) => (
                      <motion.div key={k} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 + i * 0.08 }}>
                        <dt className="text-xs text-muted">{k}</dt>
                        <dd className="serif mt-1 text-2xl font-bold tabular">{v}</dd>
                        <dd className="text-xs text-muted">{sub}</dd>
                      </motion.div>
                    ))}
                  </dl>
                </Panel>
                <Panel title="Ready to send">
                  <Actions key={chosen.plan.id} actions={actions} />
                </Panel>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          <Panel title="Send a disruption" aside={<span className="typed text-[11px] text-muted">DEMO</span>}>
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
                    className={`flex items-center gap-3 rounded-[14px] border-2 bg-surface p-3 text-left shadow-[0_2px_0_var(--edge)] transition-colors disabled:opacity-50 ${active ? "border-bad" : "border-transparent hover:border-line"}`}
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-2">
                      <Ico size={18} aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold">{sc.chaos}</span>
                      <span className="block truncate text-xs text-muted">{sc.airlineAnnouncesAt ? "Predicted before the airline says so" : sc.headline}</span>
                    </span>
                  </motion.button>
                );
              })}
            </div>
          </Panel>

          <Panel title="Your limits">
            <label htmlFor="limits" className="typed text-[11px] uppercase tracking-[0.14em] text-muted">
              In your own words
            </label>
            <textarea
              id="limits"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              className="mt-1.5 w-full resize-none rounded-xl border-2 border-line bg-surface p-3 text-sm leading-relaxed text-text placeholder:text-muted focus:border-text focus:outline-none"
            />
            <Chips c={agent.constraints ?? parseConstraints(text)} />
            {!agent.constraints && <p className="mt-2 text-xs text-muted">The agent turns this into hard and soft limits when a disruption hits.</p>}
          </Panel>

          <Link
            href={`/stranded?s=${scenarioId ?? "inbound-delay"}`}
            className="flex items-center justify-between rounded-[22px] bg-surface p-4 text-sm shadow-[0_2px_0_var(--edge)] transition-transform active:scale-[0.99]"
          >
            <span>
              <span className="block font-semibold">Stranded mode</span>
              <span className="text-xs text-muted">Low battery? The same recovery as a 1, 2, 3 chat</span>
            </span>
            <ArrowRight size={18} aria-hidden />
          </Link>
        </aside>
      </div>
    </div>
  );
}
