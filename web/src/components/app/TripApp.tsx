"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowsClockwise,
  Bed,
  ChatCircleText,
  Check,
  Clock,
  MagnifyingGlass,
  Receipt,
  Scales,
  Warning,
  type Icon,
} from "@phosphor-icons/react";
import { clock, draftActions, dur, findAffected, fmt, parseConstraints, rankPlans, rupees, type Action, type Constraints, type Evaluated, type Leg, type Scenario } from "@/lib/engine";
import type { Verdict } from "@/lib/agent";
import { scenarios, trip } from "@/lib/world";
import { Ticket, type Look } from "./Ticket";
import { useAgent } from "./useAgent";

type Screen = "home" | "alert" | "think" | "options" | "review" | "booking" | "done";
interface Row {
  e: Evaluated;
  verdict: Verdict;
  why: string;
}

const ACTION_ICON: Record<Action["kind"], Icon> = { rebook: ArrowsClockwise, refund: Receipt, claim: Scales, hotel: Bed, notify: ChatCircleText };
const event = trip.bookings.find((b) => b.mode === "event")!;
const city = event.to!.split(", ").at(-1)!;
const companion = trip.companion.match(/, (\w+)/)?.[1] ?? trip.companion;
const initials = trip.traveller
  .split(" ")
  .map((w) => w[0])
  .join("");
// The agent's step log is written for the console; the app says it in plain words.
function plain(tool: string, text: string, s: Scenario, affected: number) {
  const check = text.match(/^(\d+) pass, (\d+) ruled out/);
  const say: Record<string, string> = {
    get_bookings: `Checked your ${trip.bookings.length} bookings`,
    find_affected: `${affected} of them are affected`,
    parse_constraints: "Read your limits",
    search_alternatives: `Checking ${s.plans.length} ways to get there`,
    check_constraints: check ? `${check[1]} get you there in time${+check[2] ? `, ${check[2]} broke your limits` : ""}` : text,
    draft_messages: "Drafted the bookings and messages for you to approve",
  };
  return say[tool] ?? text;
}
const NAME: Record<string, string> = { flight: "flight", train: "train", bus: "bus", cab: "cab", hotel: "hotel", event: "the muhurtham" };

// What to do next for the first leg of a trip.
function nextUp(l: Leg): [string, string] {
  if (l.mode === "flight") return [`Leave for the airport by ${clock(l.dep! - 120)}`, `${l.title} boards ${clock(l.dep! - 40)}`];
  if (l.mode === "train") return [`Be at ${l.from} by ${clock(l.dep! - 20)}`, `${l.title} leaves ${clock(l.dep!)}`];
  return [l.title, ""];
}

function chips(c: Constraints) {
  return [
    c.deadline !== null && `By ${fmt(c.deadline)}`,
    c.budget !== null && `Max ${rupees(c.budget)} extra`,
    c.noOvernightBus && "No overnight buses",
    c.maxLayover !== null && `Waits under ${dur(c.maxLayover)}`,
    c.companion && `Short waits for ${c.companion}`,
  ].filter(Boolean) as string[];
}

// Headings type themselves out, like a ticket printer.
function Typed({ text, className = "" }: { text: string; className?: string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    const f = (now: number) => {
      const p = Math.min(1, (now - start) / 700);
      setN(Math.floor(p * text.length));
      if (p < 1) raf = requestAnimationFrame(f);
    };
    raf = requestAnimationFrame(f);
    return () => cancelAnimationFrame(raf);
  }, [text]);
  return (
    <h1 aria-label={text} className={`serif mb-2 mt-1.5 text-[30px] font-bold leading-[1.08] tracking-[-0.02em] ${className}`}>
      <span aria-hidden>{text.slice(0, n)}</span>
      <span aria-hidden className="opacity-0">
        {text.slice(n)}
      </span>
    </h1>
  );
}

const Eyebrow = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <p className={`typed text-[11px] uppercase tracking-[0.14em] opacity-60 ${className}`}>{children}</p>
);
const Back = ({ to, label, go }: { to: Screen; label: string; go: (s: Screen) => void }) => (
  <button type="button" onClick={() => go(to)} className="flex items-center gap-1.5 text-sm font-semibold opacity-75">
    <ArrowLeft size={16} aria-hidden />
    {label}
  </button>
);
const Cta = ({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="flex w-full items-center justify-center gap-2 rounded-[14px] bg-[var(--ink)] p-4 text-base font-bold text-[#fffaf0] transition-transform active:scale-[0.98] disabled:opacity-40"
  >
    {children}
  </button>
);
function Status({ bad, children }: { bad?: boolean; children: React.ReactNode }) {
  return (
    <span className="typed inline-flex items-center gap-2 rounded-full bg-[var(--card)] px-3 py-2 text-xs font-semibold" style={{ color: bad ? "var(--stop)" : "var(--go)" }}>
      <span className="pulse" />
      {children}
    </span>
  );
}
function Next({ leg }: { leg: Leg }) {
  const [a, b] = nextUp(leg);
  return (
    <div className="mt-4 flex items-center gap-3 rounded-[14px] bg-[var(--card)] px-4 py-3.5 text-sm shadow-[0_2px_0_var(--edge)]">
      <Clock size={22} aria-hidden className="shrink-0" />
      <div>
        <b>{a}</b>
        {b && <p className="opacity-70">{b}</p>}
      </div>
    </div>
  );
}
function Topbar({ children }: { children?: React.ReactNode }) {
  return (
    <div className="mb-[18px] flex items-center justify-between">
      {children ?? (
        <>
          <span className="serif flex items-center gap-2 text-xl font-bold tracking-tight">
            <Mark />
            Domino
          </span>
          <span className="grid size-[34px] place-items-center rounded-full bg-[var(--ink)] text-xs font-bold text-[var(--sheet)]">{initials}</span>
        </>
      )}
    </div>
  );
}
// Two dominoes, the first one falling.
const Mark = () => (
  <svg width="22" height="20" viewBox="0 0 22 20" aria-hidden>
    <rect x="2" y="2" width="8" height="18" rx="2" fill="currentColor" opacity=".45" transform="rotate(-18 2 20)" />
    <rect x="11" y="2" width="8" height="18" rx="2" fill="currentColor" />
  </svg>
);

export function TripApp() {
  const agent = useAgent();
  const [screen, setScreen] = useState<Screen>("home");
  const [s, setS] = useState<Scenario | null>(null);
  const [limits, setLimits] = useState(trip.defaultConstraints);
  const [editLimits, setEditLimits] = useState(false);
  const [picking, setPicking] = useState(false);
  const [notif, setNotif] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const [booked, setBooked] = useState(0);
  const notifTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const go = (next: Screen) => {
    clearTimeout(notifTimer.current);
    setNotif(false);
    setScreen(next);
  };

  const nodes = useMemo(() => findAffected(trip, s), [s]);
  const rows: Row[] = useMemo(() => {
    if (!s || !agent.result) return [];
    const said = new Map(agent.result.ranked.map((r) => [r.planId, r]));
    return rankPlans(trip, s, agent.constraints ?? parseConstraints(limits)).map((e) => ({
      e,
      verdict: e.hardFails.length ? "ruled-out" : (said.get(e.plan.id)?.verdict ?? "backup"),
      why: said.get(e.plan.id)?.explanation ?? e.notes[0] ?? "",
    }));
  }, [s, agent.result, agent.constraints, limits]);
  const ok = rows.filter((r) => r.verdict !== "ruled-out");
  const chosen = ok.find((r) => r.e.plan.id === sel)?.e ?? ok[0]?.e ?? null;
  const actions = s && chosen ? draftActions(trip, s, chosen) : [];

  // A disruption arrives as a push notification, then opens by itself.
  const disrupt = (sc: Scenario) => {
    agent.reset();
    setS(sc);
    setSel(null);
    setPicking(false);
    setNotif(true);
    notifTimer.current = setTimeout(() => go("alert"), 3800);
  };
  const fix = () => {
    agent.run(s!.id, limits);
    go("think");
  };

  // Results in: show the options. Approved: tick each action off, then show the repaired trip.
  useEffect(() => {
    if (screen !== "think" || agent.running || !agent.result) return;
    const t = setTimeout(() => setScreen("options"), 700);
    return () => clearTimeout(t);
  }, [screen, agent.running, agent.result]);
  useEffect(() => {
    if (screen !== "booking") return;
    if (booked >= actions.length) {
      const t = setTimeout(() => setScreen("done"), 900);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setBooked((n) => n + 1), 650);
    return () => clearTimeout(t);
  }, [screen, booked, actions.length]);

  const startOver = () => {
    agent.reset();
    setS(null);
    go("home");
  };

  const c = agent.constraints ?? parseConstraints(limits);
  const hit = nodes.find((n) => n.status === "broken" || n.status === "cancelled");
  const atRisk = nodes.filter((n) => n.status === "at-risk").map((n) => NAME[n.leg.mode]);
  const stampFor = (n: (typeof nodes)[number]): [Look, string] | [Look] => {
    if (n.status === "delayed") return ["late", `+${dur(s!.effects.find((x) => x.booking === n.leg.id)?.delay ?? 0).toUpperCase()} LATE`];
    if (n.status === "cancelled") return ["broken", "CANCELLED"];
    if (n.status === "broken") return ["broken", "MISSED"];
    if (n.status === "at-risk") return ["risk", "AT RISK"];
    return ["plain"];
  };

  const SCREENS: Record<Screen, () => React.ReactNode> = {
    home: () => (
      <>
        <Topbar />
        <Eyebrow>
          {trip.date.replace(/ \d{4}$/, "")} · with {companion}
        </Eyebrow>
        <Typed text={`Your trip to ${city}`} />
        <p className="text-[15px] opacity-70">
          {event.title.replace(/ muhurtham$/, "")}, {fmt(event.at!).replace("Tue", "Tuesday")}
        </p>
        <ol className="my-3.5 grid gap-2">
          {trip.bookings.map((l, i) => (
            <Ticket key={l.id} leg={l} i={i} />
          ))}
        </ol>
        <div>
          <Status>Watching {trip.bookings.length} bookings · all on time</Status>
        </div>
        <Next leg={trip.bookings[0]} />
        <div className="flex-1" />
        <div className="mt-3 rounded-xl border border-dashed border-[var(--faded)] p-2.5 text-xs">
          <button type="button" onClick={() => setPicking((p) => !p)} aria-expanded={picking} className="typed w-full opacity-70">
            Demo: send a disruption
          </button>
          <AnimatePresence initial={false}>
            {picking && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="grid grid-cols-2 gap-2 pt-2.5">
                  {scenarios.map((sc) => (
                    <button key={sc.id} type="button" onClick={() => disrupt(sc)} className="typed rounded-md bg-[var(--card)] px-2 py-2 text-left shadow-[0_2px_0_var(--edge)] active:scale-[0.98]">
                      {sc.chaos}
                    </button>
                  ))}
                </div>
                <Link href="/stranded" className="typed mt-2.5 block text-center underline-offset-4 opacity-60 hover:underline">
                  Low battery? Stranded mode
                </Link>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </>
    ),

    alert: () => (
      <>
        <Topbar>
          <Back to="home" label="Trip" go={startOver} />
          <Status bad>Disruption</Status>
        </Topbar>
        <Eyebrow>
          Detected {clock(s!.detectedAt)}
          {s!.airlineAnnouncesAt && ` · ${s!.airlineAnnouncesAt - s!.detectedAt} min before IndiGo`}
        </Eyebrow>
        <Typed text={s!.headline} />
        <p className="text-[15px] opacity-70">{s!.signals[0]}</p>
        <ol className="my-3.5 grid gap-2">
          {nodes.map((n, i) => {
            const [look, stamp] = stampFor(n);
            return <Ticket key={n.leg.id} leg={n.leg} look={look} stamp={stamp} i={i} />;
          })}
        </ol>
        <p className="text-sm font-semibold text-[var(--stop)]">
          {hit?.status === "broken" && `${hit.reason}. `}
          {atRisk.length > 0 && `${`Your ${atRisk.join(", ").replace(/, ([^,]+)$/, " and $1")}`.replace("Your the", "The")} ${atRisk.length > 1 ? "are" : "is"} at risk.`}
        </p>
        <div className="mt-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {chips(parseConstraints(limits)).map((t) => (
              <span key={t} className="typed rounded border border-dashed border-[#b5a98f] bg-[var(--card)] px-2.5 py-1.5 text-xs">
                {t}
              </span>
            ))}
            <button type="button" onClick={() => setEditLimits((v) => !v)} className="px-1 text-xs font-semibold underline underline-offset-4 opacity-70">
              {editLimits ? "Done" : "Edit limits"}
            </button>
          </div>
          {editLimits && (
            <textarea
              aria-label="Your limits, in your own words"
              value={limits}
              onChange={(e) => setLimits(e.target.value)}
              rows={3}
              className="mt-2 w-full resize-none rounded-xl border-2 border-[var(--edge)] bg-[var(--card)] p-3 text-sm leading-relaxed focus:border-[var(--ink)] focus:outline-none"
            />
          )}
        </div>
        <div className="min-h-[18px] flex-1" />
        <Cta onClick={fix}>
          Fix my trip <ArrowRight size={18} weight="bold" aria-hidden />
        </Cta>
      </>
    ),

    think: () => (
      <>
        <Topbar>
          <Back to="alert" label="Back" go={go} />
          {agent.mode && <Eyebrow>{agent.mode === "ai" ? "Live AI (Groq)" : "Built-in planner"}</Eyebrow>}
        </Topbar>
        <Eyebrow>Working on it</Eyebrow>
        <Typed text={`Finding a way to ${city}`} />
        <div className="my-2.5 flex flex-wrap gap-1.5">
          {chips(c).map((t) => (
            <span key={t} className="typed rounded border border-dashed border-[#b5a98f] bg-[var(--card)] px-2.5 py-1.5 text-xs">
              {t}
            </span>
          ))}
        </div>
        <ol className="my-[18px] grid gap-3" aria-live="polite">
          {agent.steps.map((st, i) => (
            <motion.li key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="flex items-start gap-2.5 text-sm">
              <Check size={18} weight="bold" aria-hidden className="mt-px shrink-0 text-[var(--go)]" />
              {plain(st.tool, st.text, s!, nodes.filter((n) => n.status !== "ok").length)}
            </motion.li>
          ))}
          {agent.running && (
            <li className="flex items-center gap-2.5 text-sm opacity-60">
              <MagnifyingGlass size={18} aria-hidden className="animate-pulse" />
              Checking every way to get there…
            </li>
          )}
        </ol>
        {agent.error && (
          <div className="mt-auto space-y-3">
            <p className="text-sm font-semibold text-[var(--stop)]">{agent.error}.</p>
            <Cta onClick={fix}>Try again</Cta>
          </div>
        )}
      </>
    ),

    options: () => (
      <>
        <Topbar>
          <Back to="alert" label="Back" go={go} />
          <Eyebrow>{ok.length} options</Eyebrow>
        </Topbar>
        <Typed text="Here's how to fix it" />
        <p className="mb-3.5 text-[15px] opacity-70">{agent.result?.summary ?? `Ranked for you and ${companion}.`}</p>
        <div role="radiogroup" aria-label="Recovery options" className="grid gap-2.5">
          {ok.map((r, i) => {
            const on = r.e === chosen;
            return (
              <motion.button
                key={r.e.plan.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setSel(r.e.plan.id)}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0, rotate: on ? -0.6 : 0 }}
                transition={{ duration: 0.4, delay: i * 0.07 }}
                className={`w-full rounded-[14px] border-2 bg-[var(--card)] p-4 text-left shadow-[0_2px_0_var(--edge)] transition-colors ${on ? "border-[var(--ink)]" : "border-transparent"}`}
              >
                <div className="flex items-baseline justify-between gap-2.5">
                  <h3 className="font-bold tracking-tight">{r.e.plan.label}</h3>
                  {r.verdict === "recommended" && <span className="typed shrink-0 rounded bg-[var(--go)] px-2 py-1 text-[11px] font-bold text-[#fffaf0]">Best</span>}
                  {r.verdict === "risky" && <span className="typed shrink-0 rounded bg-[var(--stop)] px-2 py-1 text-[11px] font-bold text-[#fffaf0]">Risky</span>}
                </div>
                <dl className="mt-2.5 flex gap-4 text-[13px]">
                  {[
                    ["Arrive", fmt(r.e.arrival)],
                    [r.e.extraCost < 0 ? "You save" : "Extra", rupees(Math.abs(r.e.extraCost))],
                    ["Changes", String(r.e.changes)],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <dt>{k}</dt>
                      <dd className="text-[15px] font-bold">{v}</dd>
                    </div>
                  ))}
                </dl>
                {r.why && <p className="mt-2 text-[13px] opacity-75">{r.why}</p>}
              </motion.button>
            );
          })}
        </div>
        {rows.length > ok.length && (
          <p className="px-1 pb-3.5 pt-1.5 text-[13px] opacity-60">
            {rows.length - ok.length} more ruled out by your limits
          </p>
        )}
        <div className="flex-1" />
        <Cta onClick={() => go("review")} disabled={!chosen}>
          Review this plan <ArrowRight size={18} weight="bold" aria-hidden />
        </Cta>
      </>
    ),

    review: () => (
      <>
        <Topbar>
          <Back to="options" label="Options" go={go} />
        </Topbar>
        <Eyebrow>Your new trip</Eyebrow>
        <Typed text={chosen!.plan.label} />
        <ol className="my-3.5 grid gap-2">
          {chosen!.steps.map((l, i) => (
            <Ticket
              key={l.id}
              leg={l}
              i={i}
              look={l.isNew ? "fresh" : "kept"}
              stamp={l.isNew ? "NEW" : "KEPT"}
              sub={l.mode === "hotel" && chosen!.lateCheckIn ? `Late check-in ${clock(chosen!.arrival + (l.connectMin ?? 20))}` : undefined}
            />
          ))}
        </ol>
        <Eyebrow className="mb-2">Domino will</Eyebrow>
        <ul className="mb-4 grid gap-2">
          {actions.map((a) => {
            const Ico = ACTION_ICON[a.kind];
            return (
              <li key={a.id}>
                <details className="group text-sm">
                  <summary className="flex cursor-pointer list-none items-start gap-2.5">
                    <Ico size={18} aria-hidden className="mt-px shrink-0" />
                    <span className="flex-1">{a.title}</span>
                    <span className="typed text-[11px] opacity-50 group-open:hidden">view</span>
                  </summary>
                  <pre className="mt-2 whitespace-pre-wrap break-words rounded-xl bg-[var(--card)] p-3 font-sans text-[13px] leading-relaxed">
                    <span className="typed block pb-1 text-[11px] opacity-60">To {a.to}</span>
                    {a.body}
                  </pre>
                </details>
              </li>
            );
          })}
        </ul>
        <div className="flex-1" />
        <div className="mb-2.5 flex items-baseline justify-between px-0.5 py-3.5">
          <span>{chosen!.extraCost < 0 ? "You get back, for 2" : "Extra for 2 people"}</span>
          <b className="text-2xl tracking-tight">{rupees(Math.abs(chosen!.extraCost))}</b>
        </div>
        <Cta
          onClick={() => {
            setBooked(0);
            go("booking");
          }}
        >
          Approve and book
        </Cta>
        <button type="button" onClick={() => go("options")} className="w-full p-3 text-sm font-semibold opacity-70">
          See other options
        </button>
      </>
    ),

    booking: () => (
      <>
        <div className="flex-1" />
        <Eyebrow className="text-center">Booking</Eyebrow>
        <Typed text="Securing your seats" className="text-center" />
        <ul className="my-[18px] grid justify-items-center gap-3" aria-live="polite">
          {actions.slice(0, booked).map((a) => (
            <motion.li key={a.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2.5 text-sm">
              <Check size={18} weight="bold" aria-hidden className="text-[var(--go)]" />
              {a.title}
            </motion.li>
          ))}
        </ul>
        <div className="flex-1" />
        <p className="typed text-center text-[11px] opacity-50">Demo: nothing is really booked or sent.</p>
      </>
    ),

    done: () => (
      <>
        <Topbar />
        <Eyebrow>Fixed at {clock(s!.detectedAt + 3)}</Eyebrow>
        <Typed text="You're back on track" />
        <p className="text-[15px] opacity-70">
          You&apos;ll reach {city} {fmt(chosen!.arrival)}
          {chosen!.buffer !== null && ` with ${dur(chosen!.buffer)} to spare`}.
        </p>
        <ol className="my-3.5 grid gap-2">
          {chosen!.steps.map((l, i) => (
            <Ticket key={l.id} leg={l} i={i} look={l.isNew ? "fresh" : "kept"} stamp={l.isNew ? "NEW" : "KEPT"} />
          ))}
          <Ticket leg={event} i={chosen!.steps.length} look="kept" stamp="ON TIME" />
        </ol>
        <div>
          <Status>Watching {chosen!.steps.length + 1} bookings · all on time</Status>
        </div>
        <Next leg={chosen!.steps[0]} />
        <div className="flex-1" />
        <button type="button" onClick={startOver} className="w-full p-3 text-sm font-semibold opacity-70">
          Start again
        </button>
      </>
    ),
  };

  return (
    <div className="paper relative h-[100dvh] overflow-hidden">
      <div className="absolute inset-x-0 bottom-0 top-4 isolate mx-auto w-full overflow-hidden rounded-t-[26px] bg-[var(--sheet)] shadow-[0_2px_0_#c9bfa9,0_50px_70px_-40px_rgb(60_40_20/0.55)] sm:top-1/2 sm:h-[min(860px,calc(100dvh-48px))] sm:w-[410px] sm:-translate-y-1/2 sm:rounded-[40px]">
        <AnimatePresence>
          {notif && s && (
            <motion.button
              type="button"
              onClick={() => go("alert")}
              initial={{ y: "-130%" }}
              animate={{ y: 0 }}
              exit={{ y: "-130%" }}
              transition={{ type: "spring", stiffness: 260, damping: 24 }}
              className="absolute inset-x-3 top-3 z-20 flex gap-3 rounded-2xl bg-[var(--card)] p-3.5 text-left shadow-[0_2px_0_var(--edge),0_20px_30px_-20px_rgb(60_40_20/0.5)]"
            >
              <span className="grid size-[38px] shrink-0 place-items-center rounded-lg bg-[var(--stop)] text-white">
                <Warning size={20} weight="bold" aria-hidden />
              </span>
              <span>
                <b className="flex justify-between text-sm">
                  Domino <span className="text-xs font-normal opacity-60">now</span>
                </b>
                <span className="mt-0.5 block text-[13px]">{s.headline}. Tap to fix it.</span>
              </span>
            </motion.button>
          )}
        </AnimatePresence>
        <AnimatePresence initial={false}>
          <motion.section
            key={screen}
            initial={{ opacity: 0, x: 40, rotate: 1 }}
            animate={{ opacity: 1, x: 0, rotate: 0 }}
            exit={{ opacity: 0, x: -40, rotate: -1 }}
            transition={{ duration: 0.55, ease: [0.2, 0.8, 0.2, 1] }}
            className="absolute inset-0 flex flex-col overflow-y-auto px-[22px] pb-6 pt-[22px] [scrollbar-width:none]"
          >
            {SCREENS[screen]()}
          </motion.section>
        </AnimatePresence>
      </div>
    </div>
  );
}
