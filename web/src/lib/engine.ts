// Deterministic recovery engine. Every time, connection and rupee is checked here;
// the LLM only reads these results and explains them. No imports, so it runs in Node too.

export type Mode = "flight" | "train" | "bus" | "cab" | "hotel" | "event";

export interface Leg {
  id: string;
  mode: Mode;
  title: string;
  from?: string;
  to?: string;
  dep?: number; // minutes from Mon 00:00
  arr?: number;
  at?: number; // events
  checkInBy?: number; // hotels; missing = 24h desk
  connectMin?: number; // buffer needed after the previous step
  price?: number; // paid (bookings) or cost to book (alternatives), both travellers
  seatsLeft?: number;
  overnight?: boolean;
  distanceKm?: number;
  changes?: number;
  ref?: string;
  note?: string;
}

// Times are minutes from 00:00 on the Monday of the trip's week (`week`), so day names never drift.
export interface Trip {
  traveller: string;
  companion?: string;
  passengers?: number; // default: 2 with a companion, else 1
  date: string;
  week?: string; // ISO date of that Monday
  waitingFor?: { name: string; relation: string };
  defaultConstraints: string;
  bookings: Leg[];
}

export interface Plan {
  id: string;
  label: string;
  steps: string[];
  refunds: { booking: string; amount: number; note: string }[];
}

export interface Scenario {
  id: string;
  chaos: string;
  headline: string;
  detectedAt: number;
  airlineAnnouncesAt?: number;
  claim?: string;
  effects: { booking: string; delay?: number; cancel?: boolean }[];
  signals: string[];
  legs: Leg[];
  plans: Plan[];
}

export interface Constraints {
  deadline: number | null;
  budget: number | null;
  noOvernightBus: boolean;
  maxLayover: number | null;
  companion: string | null;
}

export type Status = "ok" | "delayed" | "cancelled" | "broken" | "at-risk" | "repaired";
export interface ChainNode {
  leg: Leg;
  status: Status;
  reason: string;
}

const isTransport = (l: Leg) => l.mode === "flight" || l.mode === "train" || l.mode === "bus" || l.mode === "cab";

// ---------- formatting ----------

export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export function fmt(min: number) {
  const day = DAYS[((Math.floor(min / 1440) % 7) + 7) % 7];
  const m = ((min % 1440) + 1440) % 1440;
  return `${day} ${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}
export const clock = (min: number) => fmt(min).slice(4);
export function dur(min: number) {
  const h = Math.floor(Math.abs(min) / 60);
  const m = Math.abs(min) % 60;
  return `${min < 0 ? "-" : ""}${h ? `${h}h` : ""}${h && m ? " " : ""}${m || !h ? `${m}m` : ""}`;
}
export const rupees = (n: number) => `${n < 0 ? "-" : ""}₹${Math.abs(n).toLocaleString("en-IN")}`;

// ---------- detect: walk the chain ----------

function effective(leg: Leg, s: Scenario | null): Leg & { delay: number; cancelled: boolean } {
  const e = s?.effects.find((x) => x.booking === leg.id);
  const delay = e?.delay ?? 0;
  return {
    ...leg,
    dep: leg.dep !== undefined ? leg.dep + delay : undefined,
    arr: leg.arr !== undefined ? leg.arr + delay : undefined,
    delay,
    cancelled: !!e?.cancel,
  };
}

export function findAffected(trip: Trip, s: Scenario | null): ChainNode[] {
  let ready: number | null = null;
  let brokenUpstream = false;
  return trip.bookings.map((b): ChainNode => {
    const leg = effective(b, s);
    if (leg.cancelled) {
      brokenUpstream ||= isTransport(leg);
      return { leg, status: "cancelled", reason: s?.id === "hotel-overbooked" ? "Overbooked, room released" : "Cancelled" };
    }
    if (brokenUpstream) return { leg, status: "at-risk", reason: "Arrival unknown after the break upstream" };
    const need = (ready ?? -Infinity) + (leg.connectMin ?? 0);
    if (isTransport(leg)) {
      if (leg.dep! < need) {
        brokenUpstream = true;
        return { leg, status: "broken", reason: `Leaves ${clock(leg.dep!)}, you can't get there before ${clock(need)}` };
      }
      ready = leg.arr!;
      return leg.delay
        ? { leg, status: "delayed", reason: `${dur(leg.delay)} late, now ${clock(leg.dep!)} to ${clock(leg.arr!)}` }
        : { leg, status: "ok", reason: "On time" };
    }
    if (leg.mode === "hotel" && leg.checkInBy !== undefined && need > leg.checkInBy)
      return { leg, status: "broken", reason: `Desk closes ${clock(leg.checkInBy)}, you'd arrive ${clock(need)}` };
    if (leg.mode === "event" && need > leg.at!)
      return { leg, status: "broken", reason: `You'd reach the venue at ${clock(need)}` };
    return { leg, status: "ok", reason: "On track" };
  });
}

// ---------- constraints from plain language (offline parser; the AI does this when online) ----------

// When the first booking starts, in minutes.
export const tripStart = (t: Trip) => Math.min(...t.bookings.map((b) => b.dep ?? b.at ?? 0));

// A weekday before the trip starts means the next week.
export const dayAt = (day: number, from = 0) => (day * 1440 < Math.floor(from / 1440) * 1440 ? day + 7 : day) * 1440;

// `from`: when the trip starts, so "by 9am Tuesday" lands on the right Tuesday.
export function parseConstraints(text: string, from = 0): Constraints {
  const t = text.toLowerCase();
  let deadline: number | null = null;
  const d = t.match(/by\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:on\s+)?(mon|tue|wed|thu|fri|sat|sun)/);
  if (d) {
    let h = Number(d[1]) % 12;
    if (d[3] === "pm") h += 12;
    if (!d[3] && Number(d[1]) === 12) h = 12;
    deadline = dayAt(DAYS.map((x) => x.toLowerCase()).indexOf(d[4]), from) + h * 60 + Number(d[2] ?? 0);
  }
  const b = t.match(/(?:₹|rs\.?|inr)\s?([\d,]+)/);
  const lay = t.match(/(\d+)\s*(?:h|hr|hour)s?\s*(?:max\s*)?layover/);
  const comp = t.match(/\b(mum|mom|mother|amma|dad|father|parents?|grand(?:ma|pa|mother|father)|kids?|child|baby)\b/);
  return {
    deadline,
    budget: b ? Number(b[1].replace(/,/g, "")) : null,
    noOvernightBus: /no\s+(?:overnight|night|sleeper)\s+bus/.test(t),
    maxLayover: lay ? Number(lay[1]) * 60 : /layover/.test(t) ? 120 : null,
    companion: comp ? comp[1] : null,
  };
}

// ---------- search + check: evaluate each candidate plan ----------

export interface Evaluated {
  plan: Plan;
  steps: (Leg & { isNew: boolean })[];
  arrival: number;
  extraCost: number;
  changes: number;
  maxLayover: number;
  buffer: number | null;
  lateCheckIn: boolean;
  seatsLeft: number | null;
  hardFails: string[];
  notes: string[];
  risky: boolean;
  score: number;
}

export function evaluatePlan(trip: Trip, s: Scenario, plan: Plan, c: Constraints): Evaluated {
  const byId = new Map<string, Leg>([...trip.bookings, ...s.legs].map((l) => [l.id, l]));
  const steps = plan.steps.map((id) => {
    const original = trip.bookings.some((b) => b.id === id);
    return { ...(original ? effective(byId.get(id)!, s) : byId.get(id)!), isNew: !original };
  });
  const hardFails: string[] = [];
  const notes: string[] = [];
  let ready: number | null = null;
  let arrival = 0;
  let maxLayover = 0;
  let lateCheckIn = false;

  steps.forEach((st, i) => {
    if (isTransport(st)) {
      if (ready !== null) {
        if (st.dep! < ready + (st.connectMin ?? 0)) hardFails.push(`Can't make ${st.title}: connection too tight`);
        maxLayover = Math.max(maxLayover, st.dep! - ready - (st.connectMin ?? 0));
      }
      ready = arrival = st.arr!;
    } else if (st.mode === "hotel") {
      const lastStep = i === steps.length - 1;
      if (lastStep && ready !== null) {
        const reach = ready + (st.connectMin ?? 0);
        if (st.checkInBy !== undefined && reach > st.checkInBy) {
          lateCheckIn = true;
          notes.push(`Reaches the hotel ${clock(reach)}, after the desk closes at ${clock(st.checkInBy)}. Late check-in message drafted.`);
        } else if (st.checkInBy !== undefined && st.checkInBy - reach < 15) {
          notes.push(`Only ${st.checkInBy - reach} min before the hotel desk closes.`);
        }
      } else {
        ready = null; // an overnight rest is not a layover
      }
    }
  });

  const changes = steps.filter((x) => x.isNew).reduce((n, x) => n + (x.changes ?? 1), 0);
  const extraCost =
    steps.filter((x) => x.isNew).reduce((n, x) => n + (x.price ?? 0), 0) - plan.refunds.reduce((n, r) => n + r.amount, 0);
  const buffer = c.deadline !== null ? c.deadline - arrival : null;
  const seats = steps.filter((x) => x.isNew && x.seatsLeft !== undefined).map((x) => x.seatsLeft!);
  const seatsLeft = seats.length ? Math.min(...seats) : null;

  if (buffer !== null && buffer < 0) hardFails.push(`Arrives ${fmt(arrival)}, after your ${fmt(c.deadline!)} deadline`);
  if (c.budget !== null && extraCost > c.budget) hardFails.push(`${rupees(extraCost - c.budget)} over your ${rupees(c.budget)} limit`);
  if (c.noOvernightBus && steps.some((x) => x.mode === "bus" && x.overnight)) hardFails.push("Uses an overnight bus");
  if (c.maxLayover !== null && maxLayover > c.maxLayover)
    hardFails.push(`${dur(maxLayover)} idle wait between legs, over the ${dur(c.maxLayover)} limit`);

  const originalHotel = trip.bookings.find((b) => b.mode === "hotel");
  if (originalHotel && !plan.steps.includes(originalHotel.id) && !plan.refunds.some((r) => r.booking === originalHotel.id))
    notes.push(`Your prepaid night at ${originalHotel.title} goes unused.`);
  if (seatsLeft !== null && seatsLeft <= 6) notes.push(`Only ${seatsLeft} seats left at this fare.`);
  steps.filter((x) => x.isNew && x.note).forEach((x) => notes.push(x.note!));

  const risky = buffer !== null && buffer >= 0 && buffer < 60;
  if (risky) notes.push(`Only ${dur(buffer!)} before your deadline. Risky.`);

  // Higher is better. Weights are plain and visible on purpose.
  const comfort = c.companion ? 8 : 5;
  const finalHotel = steps.at(-1)?.mode === "hotel" ? steps.at(-1)! : null;
  let score = 100;
  score += buffer === null ? 15 : (Math.min(Math.max(buffer, 0), 240) / 240) * 30;
  score -= (extraCost / (c.budget ?? 4000)) * 25;
  score -= changes * comfort;
  if (c.companion && arrival >= 1440 && arrival < 1440 + 360) score -= 10;
  if (lateCheckIn) score -= 8;
  if (finalHotel?.isNew) score -= (finalHotel.distanceKm ?? 0) * 2;
  if (notes.some((n) => n.startsWith("Only") && n.includes("desk"))) score -= 8;

  return { plan, steps, arrival, extraCost, changes, maxLayover, buffer, lateCheckIn, seatsLeft, hardFails, notes, risky, score: Math.round(score * 10) / 10 };
}

export function rankPlans(trip: Trip, s: Scenario, c: Constraints): Evaluated[] {
  return s.plans
    .map((p) => evaluatePlan(trip, s, p, c))
    .sort((a, b) => Number(a.hardFails.length > 0) - Number(b.hardFails.length > 0) || b.score - a.score);
}

export type Verdict = "recommended" | "backup" | "risky" | "ruled-out";
export function verdictOf(e: Evaluated, i: number): Verdict {
  if (e.hardFails.length) return "ruled-out";
  if (i === 0) return "recommended";
  return e.risky ? "risky" : "backup";
}

// Offline explanations in the same voice the agent uses: compare each option to the best one.
export function explain(e: Evaluated, best: Evaluated, c: Constraints): string {
  if (e.hardFails.length) return `Ruled out: ${e.hardFails.join("; ")}.`;
  const arrive = `Arrives ${fmt(e.arrival)}${e.buffer !== null ? `, ${dur(e.buffer)} before your deadline` : ""}`;
  const cost = e.extraCost <= 0 ? `saves you ${rupees(-e.extraCost)}` : `costs ${rupees(e.extraCost)} extra`;
  if (e === best) {
    const kept = e.steps.filter((x) => !x.isNew).map((x) => x.title);
    return `${arrive}, ${cost}${kept.length ? `, and keeps ${kept.join(" and ")}` : ""}.`;
  }
  const diff = best.extraCost - e.extraCost;
  const parts = [diff > 0 ? `${rupees(diff)} cheaper than the top pick` : diff < 0 ? `${rupees(-diff)} more than the top pick` : "same cost as the top pick"];
  if (e.arrival > best.arrival) parts.push(`but lands ${dur(e.arrival - best.arrival)} later`);
  if (e.changes > best.changes) parts.push(`with ${e.changes - best.changes} more change${e.changes - best.changes > 1 ? "s" : ""}${c.companion ? `, harder on your ${c.companion}` : ""}`);
  if (e.lateCheckIn) parts.push("and needs a late check-in");
  return `${arrive}. ${parts.join(" ")}.${e.risky ? " Risky." : ""}`;
}

// ---------- act: finished drafts, ready to send ----------

export interface Action {
  id: string;
  kind: "rebook" | "refund" | "claim" | "hotel" | "notify";
  title: string;
  to: string;
  body: string;
}

export const passengers = (trip: Trip) => trip.passengers ?? (trip.companion ? 2 : 1);
const airline = (l: Leg) => l.title.split(" ")[0];
const city = (place?: string) => place?.split(", ").at(-1) ?? "";

export function draftActions(trip: Trip, s: Scenario, e: Evaluated): Action[] {
  const actions: Action[] = [];
  const name = trip.traveller;
  const pax = passengers(trip);
  const forPax = pax > 1 ? `for ${pax}` : "for 1";
  const claimed = s.claim ? s.effects.find((x) => x.cancel)?.booking : undefined;
  const newLegs = e.steps.filter((x) => x.isNew);
  const finalHotel = e.steps.at(-1)?.mode === "hotel" ? e.steps.at(-1)! : null;
  const byId = new Map(trip.bookings.map((b) => [b.id, b]));

  if (newLegs.length)
    actions.push({
      id: "rebook",
      kind: "rebook",
      title: `Book ${newLegs.map((l) => l.title).join(" + ")}`,
      to: "Booking",
      body: newLegs
        .map((l) => `${l.title}${l.dep !== undefined ? `: ${l.from} ${fmt(l.dep)} to ${l.to} ${fmt(l.arr!)}` : `, ${l.to}`}. ${rupees(l.price ?? 0)} ${forPax}.`)
        .join("\n"),
    });

  for (const r of e.plan.refunds) {
    if (r.booking === claimed) continue; // the compensation claim already asks for this refund
    const b = byId.get(r.booking)!;
    actions.push({
      id: `refund-${r.booking}`,
      kind: "refund",
      title: `Refund for ${b.title}`,
      to: b.mode === "train" ? "IRCTC" : b.mode === "flight" ? `${airline(b)} customer care` : b.title,
      body: `Hello,\n\nPlease process a refund for ${b.ref ?? "my booking"} (${b.title}, ${trip.date}) ${forPax} in the name of ${name}. ${r.note}.${r.amount ? ` Expected amount: ${rupees(r.amount)}.` : ""}\n\nThank you,\n${name}`,
    });
  }

  if (s.claim === "dgca-cancellation" && claimed) {
    const f = byId.get(claimed)!;
    actions.push({
      id: "claim",
      kind: "claim",
      title: "DGCA compensation claim",
      to: `${airline(f)} customer care, cc: AirSewa`,
      body: `Subject: Compensation claim for cancelled flight ${f.title}${f.ref ? `, ${f.ref}` : ""}\n\nDear ${airline(f)} team,\n\nFlight ${f.title} (${f.from} to ${f.to}, ${trip.date}, ${clock(f.dep!)}) was cancelled at ${clock(s.detectedAt)} on the day of travel. The alternate flight offered departs more than two hours after the scheduled departure.\n\nUnder DGCA Civil Aviation Requirement Section 3, Series M, Part IV, I request:\n1. A full refund${f.price ? ` of ${rupees(f.price)}` : ""}${f.ref ? ` for ${f.ref}` : ""}.\n2. Compensation of ₹10,000 per passenger for ${pax} passenger${pax > 1 ? "s" : ""} (block time over 2 hours), or the basic fare plus airline fuel charge if lower.\n\nPlease confirm within 30 days.\n\nRegards,\n${name}`,
    });
  }

  if (finalHotel && (finalHotel.isNew || e.lateCheckIn))
    actions.push({
      id: "hotel",
      kind: "hotel",
      title: finalHotel.isNew ? `Confirm ${finalHotel.title}` : `Late check-in at ${finalHotel.title}`,
      to: finalHotel.title,
      body: `Hello,\n\n${finalHotel.isNew ? `Please confirm a room ${forPax} tonight (${trip.date}) for ${name}.` : `This is ${name}${finalHotel.ref ? `, ${finalHotel.ref}` : ""}.`} Our travel plans changed and we now expect to reach the hotel around ${clock(e.arrival + (finalHotel.connectMin ?? 20))}. Please hold the room for a late check-in.${trip.companion ? ` I'm travelling with ${trip.companion.replace(/^(?:her|his|their) /, "my ")}.` : ""}\n\nThank you,\n${name}`,
    });

  const w = trip.waitingFor;
  const event = trip.bookings.find((b) => b.mode === "event");
  const lastStop = city(e.steps.filter((x) => x.mode !== "hotel").at(-1)?.to);
  if (w)
    actions.push({
      id: "notify",
      kind: "notify",
      title: `Tell ${w.name} the new arrival time`,
      to: `${w.name} (WhatsApp)`,
      body: `Hi ${w.name}! Small change of plan: ${e.plan.label.toLowerCase()}. ${trip.companion ? "We" : "I"} now reach ${lastStop} around ${fmt(e.arrival)}${finalHotel ? ` and stay at ${finalHotel.title}` : ""}.${event && e.buffer !== null && e.buffer >= 0 ? ` All fine for ${event.title}.` : ""}`,
    });
  return actions;
}
