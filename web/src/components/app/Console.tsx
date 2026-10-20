"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { AirplaneTilt, ArrowCounterClockwise, ArrowRight, ArrowSquareOut, Bed, Lightning, MagnifyingGlass, PencilSimple, Robot, Sparkle, Train, Warning, WifiSlash, XCircle, type Icon } from "@phosphor-icons/react";
import { clock, draftActions, dur, explain, findAffected, fmt, parseConstraints, rankPlans, rupees, tripStart, verdictOf, type ChainNode, type Constraints, type Scenario } from "@/lib/engine";
import { applyPlan, newId, dateLabel, draftProblem, isTransport, needOf, nowMin, reportScenario, strategies, toLocal, toMin, withFound, dateOf, type Draft, type Found, type Report } from "@/lib/recover";
import { saveTrip, type Saved } from "@/lib/store";
import { scenarios } from "@/lib/world";
import { FlipText } from "./FlipText";
import { ICON, Ticket, type Look } from "./Ticket";
import { useAgent } from "./useAgent";
import { Plans, type PlanRow } from "./Plans";
import { Actions } from "./Actions";
import { LegFields, Setup } from "./Setup";
import { Button, Eyebrow, Field, Panel, Status, input } from "./ui";

const CHAOS_ICON: Record<string, Icon> = { "inbound-delay": AirplaneTilt, "flight-cancelled": XCircle, "train-cancelled": Train, "hotel-overbooked": Bed };
const ease = [0.16, 1, 0.3, 1] as const;

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
  if (!hard.length && !soft.length) return <p className="mt-2 text-xs text-muted">No limits found yet. Try &quot;must reach Mysuru by 9am Tuesday, max ₹4,000 extra&quot;.</p>;
  return (
    <div className="mt-3 space-y-2">
      {[
        ["Hard", hard, "var(--text)"],
        ["Soft", soft, "var(--muted)"],
      ].map(([k, list, color]) =>
        (list as string[]).length ? (
          <div key={k as string} className="flex flex-wrap items-center gap-1.5">
            <span className="typed w-9 text-[11px] text-muted">{k as string}</span>
            {(list as string[]).map((t) => (
              <span key={t} className="typed rounded border border-dashed border-[#b5a98f] bg-surface px-2.5 py-1 text-xs" style={{ color: color as string }}>
                {t}
              </span>
            ))}
          </div>
        ) : null,
      )}
    </div>
  );
}

export function Console({ saved }: { saved: Saved }) {
  const { trip, example } = saved;
  const week = trip.week ?? "2026-10-26";
  const start = tripStart(trip);
  const event = trip.bookings.find((b) => b.mode === "event");
  const city = (event?.to ?? trip.bookings.filter((b) => b.mode !== "hotel").at(-1)?.to ?? "").split(", ").at(-1);
  const legs = trip.bookings.filter((b) => b.mode !== "event");

  const agent = useAgent();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(trip.defaultConstraints);
  const [s, setS] = useState<Scenario | null>(null);
  const [report, setReport] = useState<Report>({ booking: legs.find((b) => isTransport(b.mode))?.id ?? legs[0]?.id, kind: "delay", minutes: 120 });
  const [found, setFound] = useState<Found[]>([]);
  const [adding, setAdding] = useState<{ draft: Draft; replaces: string[] } | null>(null);
  const [agentFor, setAgentFor] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [approved, setApproved] = useState(false);
  const [airlineSaid, setAirlineSaid] = useState(false);
  const [notif, setNotif] = useState(false);
  const alertRef = useRef<HTMLDivElement>(null);
  const repairedRef = useRef<HTMLDivElement>(null);
  const addRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (approved) repairedRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [approved]);
  useEffect(() => {
    if (adding) addRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [adding]);
  // Example trip only: the "airline" announces 8s after Travv's alert.
  useEffect(() => {
    if (!s?.airlineAnnouncesAt) return;
    const t = setTimeout(() => setAirlineSaid(true), 8000);
    return () => clearTimeout(t);
  }, [s]);
  useEffect(() => {
    if (!notif) return;
    const t = setTimeout(() => setNotif(false), 4500);
    return () => clearTimeout(t);
  }, [notif]);

  if (editing) return <Setup editing={trip} onDone={() => setEditing(false)} />;

  const mine = !!s?.id.startsWith("user-"); // reported by the traveller, not a curated example
  const sEval = s && mine ? withFound(trip, s, found) : s;
  const nodes = findAffected(trip, s);
  const need = s && mine ? needOf(trip, s) : null;
  const c = agent.constraints ?? parseConstraints(text, start);
  const ranked = sEval?.plans.length ? rankPlans(trip, sEval, c) : [];
  const planKey = sEval?.plans.map((p) => p.id).join() ?? "";
  const fresh = agent.result && agentFor === planKey ? agent.result : null;
  const said = new Map(fresh?.ranked.map((r) => [r.planId, r]) ?? []);
  const rows: PlanRow[] = ranked.map((e, i) => ({ e, verdict: verdictOf(e, i), explanation: said.get(e.plan.id)?.explanation ?? explain(e, ranked[0], c) }));
  const showRows = rows.length > 0 && (mine || !!fresh);
  const pickedId = rows.some((r) => r.e.plan.id === selected) ? selected : (rows[0]?.e.plan.id ?? null);
  const chosen = rows.find((r) => r.e.plan.id === pickedId)?.e ?? null;
  const actions = s && sEval && chosen && approved ? draftActions(trip, sEval, chosen) : [];
  const affected = nodes.filter((n) => n.status !== "ok").length;
  const delayOf = (id: string) => s?.effects.find((x) => x.booking === id)?.delay ?? 0;

  const clear = () => {
    agent.reset();
    setFound([]);
    setAdding(null);
    setSelected(null);
    setApproved(false);
    setAirlineSaid(false);
    setAgentFor("");
  };
  const trigger = (id: string) => {
    clear();
    setS(scenarios.find((x) => x.id === id)!);
    setNotif(true);
    setAgentFor(scenarios.find((x) => x.id === id)!.plans.map((p) => p.id).join());
    agent.run({ scenarioId: id, constraints: text });
    setTimeout(() => alertRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };
  const submitReport = () => {
    clear();
    setS(reportScenario(trip, report, nowMin(week)));
    setTimeout(() => alertRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };
  const reset = () => {
    clear();
    setS(null);
  };
  const compare = () => {
    setAgentFor(planKey);
    agent.run({ trip, scenario: sEval, constraints: text });
  };
  const startAdding = (mode: Draft["mode"]) => {
    if (!need) return;
    const draft: Draft =
      mode === "hotel"
        ? { id: newId("f"), mode, title: "", to: need.to, checkIn: dateOf(need.after, week) }
        : { id: newId("f"), mode, title: "", from: need.from, to: need.to, depart: toLocal(need.after, week) };
    setAdding({ draft, replaces: [need.leg.id] });
  };
  const addFound = () => {
    if (!adding) return;
    const d = adding.draft;
    setFound((f) => [
      ...f,
      {
        id: d.id,
        mode: d.mode,
        title: d.title.trim(),
        from: d.from,
        to: d.to,
        dep: d.depart && d.mode !== "hotel" ? toMin(d.depart, week) : undefined,
        arr: d.arrive && d.mode !== "hotel" ? toMin(d.arrive, week) : undefined,
        checkInBy: d.mode === "hotel" && d.checkInBy ? toMin(d.checkInBy, week) : undefined,
        price: d.price ?? 0,
        replaces: adding.replaces,
      },
    ]);
    setSelected(d.id);
    setAdding(null);
  };
  const saveRepaired = () => {
    if (!chosen) return;
    saveTrip({ trip: { ...applyPlan(trip, chosen.steps), defaultConstraints: text }, example });
  };
  const persistLimits = () => {
    if (text !== trip.defaultConstraints) saveTrip({ trip: { ...trip, defaultConstraints: text }, example });
  };

  const addProblem = adding ? (draftProblem(adding.draft) ?? (adding.draft.mode !== "hotel" && !adding.draft.to?.trim() ? "Add where it goes" : null)) : null;
  const breakIdx = need ? trip.bookings.findIndex((b) => b.id === need.leg.id) : -1;

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
                Travv <span className="text-xs font-normal text-muted">now</span>
              </b>
              <span className="mt-0.5 block text-[13px]">{s.headline}. I&apos;m already working on a fix.</span>
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow>
            {trip.date}
            {trip.companion && ` · with ${trip.companion.replace(/^(?:her|his|their|my) /, "")}`}
            {example && " · example"}
          </Eyebrow>
          <h1 className="mt-1.5 text-4xl font-bold leading-[1.05] md:text-5xl">Your trip{city && ` to ${city}`}</h1>
          {event && (
            <p className="mt-2 text-muted">
              For {event.title} at {fmt(event.at!)}.
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {example && (
            <p className="typed rounded-full bg-surface px-3 py-1.5 text-sm tabular shadow-[0_2px_0_var(--edge)]" aria-live="polite">
              <span className="text-muted">Now </span>
              <FlipText text={fmt(s?.detectedAt ?? 600)} />
            </p>
          )}
          {s ? (
            <Button kind="line" onClick={reset}>
              <ArrowCounterClockwise size={15} aria-hidden /> Back to my trip
            </Button>
          ) : (
            <>
              <Button kind="line" onClick={() => setEditing(true)}>
                <PencilSimple size={15} aria-hidden /> Edit bookings
              </Button>
              <Button kind="quiet" onClick={() => confirm("Start a new trip? This one will be removed from this device.") && saveTrip(null)}>
                New trip
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          <Panel title="Your bookings" aside={s && affected ? <Status bad>{`${affected} of ${nodes.length} affected`}</Status> : <Status>Watching {nodes.length} bookings</Status>}>
            <ol aria-label="Your bookings" className="grid gap-2">
              {nodes.map((n, i) => {
                const [look, st] = stamp(n, delayOf(n.leg.id));
                return <Ticket key={`${s?.id}-${n.leg.id}`} leg={n.leg} look={look} stamp={st} i={i} />;
              })}
            </ol>
            {!s && <p className="mt-4 text-sm text-muted">Something changed? Tell Travv in the panel on the right and it checks every booking that depends on it.</p>}
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
                className={`scroll-mt-6 overflow-hidden rounded-[22px] border-2 bg-surface ${need || !mine ? "border-bad" : "border-good"}`}
                role="alert"
              >
                <div className="p-4 md:p-6">
                  <Eyebrow className={need || !mine ? "!text-bad" : "!text-good"}>
                    {mine ? "You reported" : `Detected ${clock(s.detectedAt)}`}
                    {s.airlineAnnouncesAt && ` · ${s.airlineAnnouncesAt - s.detectedAt} min before the airline`}
                  </Eyebrow>
                  <h2 className="mt-1.5 flex items-start gap-2 text-2xl font-bold md:text-3xl">
                    <Lightning size={24} weight="fill" className={`mt-1 shrink-0 ${need || !mine ? "text-bad" : "text-good"}`} aria-hidden />
                    {s.headline}
                  </h2>
                  {s.signals.length > 0 && (
                    <ul className="mt-3 space-y-1.5 text-sm text-muted">
                      {s.signals.map((sig) => (
                        <li key={sig}>{sig}</li>
                      ))}
                    </ul>
                  )}
                  <ul className="mt-3 space-y-1 text-sm font-semibold">
                    {nodes
                      .filter((n) => n.status === "broken" || n.status === "at-risk" || n.status === "delayed")
                      .map((n) => (
                        <li key={n.leg.id} className={n.status === "delayed" ? "text-late" : "text-bad"}>
                          {n.leg.title.split(", ")[0]}: {n.reason}
                        </li>
                      ))}
                  </ul>
                  {mine && !need && <p className="mt-3 text-sm font-semibold text-good">Nothing else breaks. Every booking after it still works, so there&apos;s nothing to fix.</p>}
                  {s.airlineAnnouncesAt && (
                    <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl bg-bg px-4 py-3 text-sm">
                      <p>
                        <span className="text-muted">Airline app says </span>
                        <span className="typed font-bold" style={{ color: airlineSaid ? "var(--late)" : "var(--good)" }}>
                          <FlipText text={airlineSaid ? "DELAYED 2H" : "ON TIME"} />
                        </span>
                      </p>
                      <AnimatePresence>
                        {airlineSaid && (
                          <motion.p initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="font-semibold">
                            Travv warned you {s.airlineAnnouncesAt - s.detectedAt} min earlier.
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </div>
              </motion.section>
            )}
          </AnimatePresence>

          {need && (
            <Panel title="Find a way through" aside={<MagnifyingGlass size={20} aria-hidden className="text-muted" />}>
              <dl className="grid grid-cols-1 gap-3 rounded-[14px] bg-surface p-4 shadow-[0_2px_0_var(--edge)] sm:grid-cols-3">
                <div>
                  <dt className="text-xs text-muted">Get from</dt>
                  <dd className="font-semibold">
                    {need.from} → {need.to}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">{need.leg.mode === "hotel" ? "Arriving around" : "Leaving after"}</dt>
                  <dd className="typed font-bold">{dateLabel(need.after, week).slice(0, 10)} {clock(need.after)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">{need.leg.mode === "hotel" ? "Need a room" : "Arrive by"}</dt>
                  <dd className="typed font-bold">{need.leg.mode === "hotel" ? "tonight" : need.by !== null ? `${dateLabel(need.by, week).slice(0, 10)} ${clock(need.by)}` : "as soon as you can"}</dd>
                </div>
              </dl>
              <p className="mt-4 text-sm text-muted">Search these, then tell Travv what you found. It checks every option against the rest of your trip and your limits.</p>
              <ul className="mt-3 grid gap-2">
                {strategies(trip, need).map((st) => {
                  const Ico = ICON[st.mode];
                  return (
                    <li key={st.label} className="flex flex-wrap items-center gap-3 rounded-[14px] bg-surface p-3 shadow-[0_2px_0_var(--edge)]">
                      <Ico size={18} aria-hidden className="shrink-0" />
                      <span className="min-w-0 flex-1 text-sm font-semibold">{st.label}</span>
                      <span className="flex flex-wrap gap-1.5">
                        {st.links.map((l) => (
                          <a key={l.url} href={l.url} target="_blank" rel="noreferrer" className="typed inline-flex items-center gap-1 rounded border-2 border-line px-2 py-1 text-xs hover:border-text">
                            {l.name} <ArrowSquareOut size={12} aria-hidden />
                          </a>
                        ))}
                        <button type="button" onClick={() => startAdding(st.mode)} className="typed rounded bg-accent px-2.5 py-1 text-xs font-bold text-on-accent">
                          I found one
                        </button>
                      </span>
                    </li>
                  );
                })}
              </ul>

              {adding && (
                <div ref={addRef} className="mt-4 rounded-[14px] border-2 border-text bg-surface p-4">
                  <p className="mb-3 font-semibold">What did you find?</p>
                  <LegFields d={adding.draft} onChange={(draft) => setAdding({ ...adding, draft })} />
                  <fieldset className="mt-3">
                    <legend className="typed mb-1 text-[11px] uppercase tracking-[0.1em] text-muted">It replaces</legend>
                    <div className="flex flex-wrap gap-2">
                      {trip.bookings.slice(breakIdx).filter((b) => b.mode !== "event").map((b) => (
                        <label key={b.id} className="flex items-center gap-1.5 rounded border-2 border-line px-2 py-1 text-xs">
                          <input
                            type="checkbox"
                            checked={adding.replaces.includes(b.id)}
                            onChange={(e) => setAdding({ ...adding, replaces: e.target.checked ? [...adding.replaces, b.id] : adding.replaces.filter((x) => x !== b.id) })}
                          />
                          {b.title.split(", ")[0]}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <Button onClick={addFound} disabled={!!addProblem || adding.replaces.length === 0}>
                      Check it
                    </Button>
                    <Button kind="quiet" onClick={() => setAdding(null)}>
                      Cancel
                    </Button>
                    {addProblem && <span className="text-xs font-semibold text-bad">{addProblem}</span>}
                  </div>
                </div>
              )}
            </Panel>
          )}

          {(agent.steps.length > 0 || agent.running) && (
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
              {agent.error && <p className="mt-3 text-sm text-bad">{agent.error}. Try again.</p>}
            </Panel>
          )}

          <AnimatePresence mode="wait">
            {showRows && !approved && (
              <motion.div key="plans" exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.3 }}>
                <Panel
                  title={mine ? "Your options, checked" : "Here's how to fix it"}
                  aside={
                    mine && (
                      <Button kind="line" onClick={compare} disabled={agent.running || !!fresh}>
                        <Sparkle size={15} aria-hidden /> {fresh ? "Compared by AI" : agent.running ? "Comparing…" : "Compare with AI"}
                      </Button>
                    )
                  }
                >
                  {fresh && <p className="mb-4 text-sm text-muted">{fresh.summary}</p>}
                  <Plans rows={rows} selected={pickedId} onSelect={setSelected} />
                  <div className="mt-5 flex flex-wrap items-center gap-3">
                    <Button onClick={() => setApproved(true)} disabled={!chosen || chosen.hardFails.length > 0}>
                      {mine ? "Go with this" : "Approve and book"} <ArrowRight size={18} weight="bold" aria-hidden />
                    </Button>
                    {mine && (
                      <Button kind="quiet" onClick={() => need && startAdding(need.leg.mode === "hotel" ? "hotel" : need.leg.mode)}>
                        Add another option
                      </Button>
                    )}
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
                    {event && <Ticket leg={event} i={chosen.steps.length} look="kept" stamp="ON TIME" />}
                  </ol>
                  <dl className="mt-5 grid grid-cols-2 gap-4 border-t-2 border-dashed border-line pt-4 md:grid-cols-4">
                    {[
                      [`Arrive${city ? ` ${city}` : ""}`, fmt(chosen.arrival), ""],
                      [chosen.extraCost < 0 ? "You get back" : "Extra cost", rupees(Math.abs(chosen.extraCost)), mine ? "before refunds you claim" : "after refunds"],
                      ["Changes", String(chosen.changes), "new bookings"],
                      [event ? "Spare before it starts" : "Spare time", chosen.buffer !== null ? dur(chosen.buffer) : "n/a", ""],
                    ].map(([k, v, sub], i) => (
                      <motion.div key={k} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 + i * 0.08 }}>
                        <dt className="text-xs text-muted">{k}</dt>
                        <dd className="serif mt-1 text-2xl font-bold tabular">{v}</dd>
                        {sub && <dd className="text-xs text-muted">{sub}</dd>}
                      </motion.div>
                    ))}
                  </dl>
                  <div className="mt-5 flex flex-wrap items-center gap-3">
                    <Button onClick={saveRepaired}>Save as my trip</Button>
                    <span className="text-xs text-muted">Replaces your bookings with this chain, so Travv keeps watching the new one.</span>
                  </div>
                </Panel>
                <Panel title="Ready to send">
                  <Actions key={chosen.plan.id} actions={actions} />
                </Panel>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          <Panel title="Something went wrong?">
            <div className="grid gap-3">
              <Field label="Which booking">
                <select value={report.booking} onChange={(e) => setReport({ ...report, booking: e.target.value, kind: legs.find((b) => b.id === e.target.value)?.mode === "hotel" ? "cancel" : report.kind })} className={input}>
                  {legs.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.title.split(", ")[0]}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="flex gap-2" role="radiogroup" aria-label="What happened">
                {(["delay", "cancel"] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={report.kind === k}
                    disabled={k === "delay" && legs.find((b) => b.id === report.booking)?.mode === "hotel"}
                    onClick={() => setReport({ ...report, kind: k })}
                    className={`flex-1 rounded-[10px] border-2 px-3 py-2 text-sm font-semibold disabled:opacity-40 ${report.kind === k ? "border-text bg-surface" : "border-line"}`}
                  >
                    {k === "delay" ? "Delayed" : "Cancelled"}
                  </button>
                ))}
              </div>
              {report.kind === "delay" && (
                <Field label="By how long">
                  <select value={report.minutes} onChange={(e) => setReport({ ...report, minutes: Number(e.target.value) })} className={input}>
                    {[30, 60, 90, 120, 180, 240, 360, 480].map((m) => (
                      <option key={m} value={m}>
                        {dur(m)}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              <Button onClick={submitReport} disabled={!report.booking}>
                Check my trip
              </Button>
            </div>
            {example && (
              <div className="mt-5 border-t-2 border-dashed border-line pt-4">
                <Eyebrow className="mb-2">Or try a ready-made disruption</Eyebrow>
                <div className="grid gap-2">
                  {scenarios.map((sc) => {
                    const Ico = CHAOS_ICON[sc.id] ?? Lightning;
                    return (
                      <button
                        key={sc.id}
                        type="button"
                        disabled={agent.running}
                        onClick={() => trigger(sc.id)}
                        className={`flex items-center gap-3 rounded-[14px] border-2 bg-surface p-2.5 text-left shadow-[0_2px_0_var(--edge)] transition-colors disabled:opacity-50 ${sc.id === s?.id ? "border-bad" : "border-transparent hover:border-line"}`}
                      >
                        <Ico size={18} aria-hidden className="shrink-0" />
                        <span className="text-sm font-semibold">{sc.chaos}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </Panel>

          <Panel title="Your limits">
            <label htmlFor="limits" className="typed text-[11px] uppercase tracking-[0.14em] text-muted">
              In your own words
            </label>
            <textarea
              id="limits"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onBlur={persistLimits}
              rows={4}
              className={`${input} mt-1.5 resize-none leading-relaxed`}
            />
            <Chips c={c} />
          </Panel>

          {example && (
            <Link
              href={`/stranded?s=${s && !mine ? s.id : "inbound-delay"}`}
              className="flex items-center justify-between rounded-[22px] bg-surface p-4 text-sm shadow-[0_2px_0_var(--edge)] transition-transform active:scale-[0.99]"
            >
              <span>
                <span className="block font-semibold">Stranded mode</span>
                <span className="text-xs text-muted">Low battery? The same recovery as a 1, 2, 3 chat</span>
              </span>
              <ArrowRight size={18} aria-hidden />
            </Link>
          )}
        </aside>
      </div>
    </div>
  );
}
