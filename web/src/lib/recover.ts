// Recovery for a real trip: the traveller reports what went wrong, Domino works out what they need,
// points them at real searches, and the engine checks whatever they find. No made-up inventory.
import { clock, findAffected, fmt, passengers, type Leg, type Mode, type Plan, type Scenario, type Trip } from "./engine";

// ---------- dates: minutes from 00:00 on the Monday of the trip's week ----------

const DAY = 86_400_000;
const utc = (isoDate: string) => Date.UTC(+isoDate.slice(0, 4), +isoDate.slice(5, 7) - 1, +isoDate.slice(8, 10));
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

// The Monday on or before a date.
export function weekOf(isoDate: string) {
  const t = utc(isoDate);
  return iso(t - ((new Date(t).getUTCDay() + 6) % 7) * DAY);
}
// "2026-10-26T15:40" -> minutes in that week
export const toMin = (local: string, week: string) => Math.round((utc(local) - utc(week)) / 60_000) + +local.slice(11, 13) * 60 + +local.slice(14, 16);
// minutes -> "2026-10-26T15:40", for datetime inputs
export const toLocal = (min: number, week: string) => `${iso(utc(week) + Math.floor(min / 1440) * DAY)}T${clock(min)}`;
export const dateOf = (min: number, week: string) => iso(utc(week) + Math.floor(min / 1440) * DAY);
export function dateLabel(min: number, week: string) {
  const d = new Date(utc(week) + Math.floor(min / 1440) * DAY);
  return `${fmt(min).slice(0, 3)} ${d.getUTCDate()} ${d.toLocaleString("en-GB", { month: "short", timeZone: "UTC" })} ${d.getUTCFullYear()}`;
}
// Now, in the trip's minutes (local time on this device).
export function nowMin(week: string) {
  const n = new Date();
  const local = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}T${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")}`;
  return toMin(local, week);
}

// Unique enough ids for bookings created on this device.
let seq = 0;
export const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(seq++).toString(36)}`;

export const isTransport = (m: Mode) => m === "flight" || m === "train" || m === "bus" || m === "cab";
const cityOf = (place?: string) => place?.split(", ").at(-1) ?? "";

// ---------- report: what went wrong, in the engine's terms ----------

export interface Report {
  booking: string;
  kind: "delay" | "cancel";
  minutes?: number;
}

export function reportScenario(trip: Trip, r: Report, now: number): Scenario {
  const b = trip.bookings.find((x) => x.id === r.booking)!;
  const late = r.kind === "delay" ? `${b.title} is running ${Math.round((r.minutes ?? 0) / 6) / 10}h late` : null;
  return {
    id: `user-${r.booking}-${r.kind}-${r.minutes ?? 0}`,
    chaos: late ?? `${b.title} cancelled`,
    headline: late ?? (b.mode === "hotel" ? `${b.title} cancelled your booking` : `${b.title} was cancelled`),
    detectedAt: now,
    claim: r.kind === "cancel" && b.mode === "flight" ? "dgca-cancellation" : undefined,
    effects: [r.kind === "delay" ? { booking: b.id, delay: r.minutes ?? 0 } : { booking: b.id, cancel: true }],
    signals: [],
    legs: [],
    plans: [],
  };
}

// ---------- need: the gap the traveller has to fill ----------

export interface Need {
  leg: Leg; // the first broken booking
  from: string;
  to: string;
  after: number; // earliest you can start
  by: number | null; // latest you can arrive and still make the rest
}

export function needOf(trip: Trip, s: Scenario): Need | null {
  const nodes = findAffected(trip, s);
  const k = nodes.findIndex((n) => n.status === "broken" || n.status === "cancelled");
  if (k < 0) return null;
  const leg = trip.bookings[k];
  const before = nodes.slice(0, k).filter((n) => isTransport(n.leg.mode)).at(-1)?.leg;
  const after = Math.max(s.detectedAt, before ? before.arr! + (leg.connectMin ?? 0) : s.detectedAt);
  const next = trip.bookings.slice(k + 1).find((b) => b.mode !== "hotel" || b.checkInBy !== undefined);
  const by = !next ? null : isTransport(next.mode) ? next.dep! - (next.connectMin ?? 0) : next.mode === "hotel" ? next.checkInBy! - (next.connectMin ?? 0) : next.at! - (next.connectMin ?? 0);
  if (leg.mode === "hotel") return { leg, from: before?.to ?? leg.to ?? "", to: cityOf(leg.to), after, by };
  return { leg, from: leg.from ?? "", to: leg.to ?? "", after, by };
}

// ---------- search: real places to look, prefilled ----------

export interface Strategy {
  mode: Mode;
  label: string;
  links: { name: string; url: string }[];
}

const q = encodeURIComponent;
const google = (text: string) => `https://www.google.com/search?q=${q(text)}`;

export function strategies(trip: Trip, n: Need): Strategy[] {
  const week = trip.week ?? weekOf("2026-10-26");
  const day = dateLabel(n.after, week).slice(4);
  const date = dateOf(n.after, week);
  const route = `${n.from} to ${n.to}`;
  const cab: Strategy = {
    mode: "cab",
    label: `Cab from ${n.from} to ${n.to}`,
    links: [
      { name: "Drive time (Google Maps)", url: `https://www.google.com/maps/dir/?api=1&origin=${q(n.from)}&destination=${q(n.to)}&travelmode=driving` },
      { name: "Uber", url: "https://m.uber.com/" },
    ],
  };
  const bus: Strategy = { mode: "bus", label: `Bus from ${route}`, links: [{ name: "redBus", url: "https://www.redbus.in/" }, { name: "Google", url: google(`bus from ${route} ${day}`) }] };
  const train: Strategy = {
    mode: "train",
    label: `Another train from ${route}`,
    links: [{ name: "IRCTC", url: "https://www.irctc.co.in/nget/train-search" }, { name: "Google", url: google(`trains from ${route} ${day}`) }],
  };
  if (n.leg.mode === "flight")
    return [{ mode: "flight", label: `Another flight from ${route}`, links: [{ name: "Google Flights", url: `https://www.google.com/travel/flights?q=${q(`flights from ${route} on ${date}`)}` }] }];
  if (n.leg.mode === "hotel") {
    const event = trip.bookings.find((b) => b.mode === "event");
    const out = dateOf(n.after + 1440, week);
    return [
      {
        mode: "hotel",
        label: `Another room in ${n.to}`,
        links: [
          { name: "Booking.com", url: `https://www.booking.com/searchresults.html?ss=${q(n.to)}&checkin=${date}&checkout=${out}&group_adults=${passengers(trip)}` },
          { name: "Map", url: `https://www.google.com/maps/search/${q(`hotels near ${event?.to ?? n.to}`)}` },
        ],
      },
    ];
  }
  return n.leg.mode === "train" ? [train, cab, bus] : n.leg.mode === "bus" ? [bus, cab, train] : [cab, bus, train];
}

// ---------- plans: what the traveller found, as candidates the engine can check ----------

export interface Found {
  id: string;
  mode: Mode;
  title: string;
  from?: string;
  to?: string;
  dep?: number;
  arr?: number;
  checkInBy?: number;
  price: number;
  replaces: string[];
}

export function withFound(trip: Trip, s: Scenario, found: Found[]): Scenario {
  const cancelled = new Set(s.effects.filter((e) => e.cancel).map((e) => e.booking));
  const plans: Plan[] = found.map((f) => {
    const steps: string[] = [];
    for (const b of trip.bookings.filter((x) => x.mode !== "event")) {
      if (!f.replaces.includes(b.id)) steps.push(b.id);
      else if (!steps.includes(f.id)) steps.push(f.id);
    }
    return {
      id: f.id,
      label: f.title,
      steps,
      refunds: trip.bookings
        .filter((b) => f.replaces.includes(b.id) && b.price)
        .map((b) => (cancelled.has(b.id) ? { booking: b.id, amount: b.price!, note: "Full refund, the booking was cancelled by them" } : { booking: b.id, amount: 0, note: "Cancellation refund as per the fare rules" })),
    };
  });
  const legs: Leg[] = found.map((f) => ({ id: f.id, mode: f.mode, title: f.title, from: f.from, to: f.to, dep: f.dep, arr: f.arr, checkInBy: f.checkInBy, price: f.price, connectMin: isTransport(f.mode) ? 30 : 20 }));
  return { ...s, legs, plans };
}

// After approving: the repaired chain becomes the trip.
export function applyPlan(trip: Trip, steps: (Leg & { isNew: boolean })[]): Trip {
  const event = trip.bookings.find((b) => b.mode === "event");
  const clean = (l: Leg & { isNew?: boolean; delay?: number; cancelled?: boolean }): Leg => {
    const { isNew, delay, cancelled, ...leg } = l;
    void delay;
    void cancelled;
    return isNew ? { ...leg, id: `b-${leg.id}` } : leg;
  };
  return { ...trip, bookings: [...steps.map(clean), ...(event ? [event] : [])] };
}

// ---------- drafts: bookings as the form (or the AI reader) fills them in, local date-times as text ----------

export interface Draft {
  id: string;
  mode: Mode;
  title: string;
  from?: string;
  to?: string;
  depart?: string; // "2026-10-26T15:40"; events: when it starts
  arrive?: string;
  checkIn?: string; // hotels: the night it starts (date)
  checkInBy?: string; // hotels: front desk closes
  price?: number;
  ref?: string;
}

export interface TripMeta {
  traveller: string;
  companion?: string;
  passengers?: number;
  waitingFor?: string;
  limits: string;
}

const okTime = (v?: string) => !!v && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v);

// What's missing before a draft can be checked, in plain words.
export function draftProblem(d: Draft): string | null {
  if (!d.title.trim()) return "Add a name";
  if (d.mode === "hotel") return d.checkIn && /^\d{4}-\d{2}-\d{2}/.test(d.checkIn) ? null : "Add the check-in date";
  if (!okTime(d.depart)) return d.mode === "event" ? "Add when it starts" : "Add the departure time";
  if (d.mode === "event") return null;
  if (!okTime(d.arrive)) return "Add the arrival time";
  if (d.arrive! <= d.depart!) return "Arrival must be after departure";
  return null;
}

// Hotels have no clock time of their own: they sit at the end of their check-in day.
const sortKey = (d: Draft) => (d.mode === "hotel" ? `${d.checkIn!.slice(0, 10)}T23:58` : d.depart!);

export function draftsToTrip(drafts: Draft[], meta: TripMeta): Trip {
  const ds = [...drafts].sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
  const week = weekOf(sortKey(ds[0]).slice(0, 10));
  let prev: Mode | null = null;
  const bookings = ds.map((d): Leg => {
    const connect = prev === null ? undefined : d.mode === "hotel" ? 20 : d.mode === "event" ? 30 : prev === "flight" ? 90 : 30;
    prev = d.mode;
    const base = { id: d.id, mode: d.mode, title: d.title.trim(), price: d.price || undefined, ref: d.ref?.trim() || undefined, connectMin: connect };
    if (d.mode === "hotel") return { ...base, to: d.to?.trim() || undefined, checkInBy: okTime(d.checkInBy) ? toMin(d.checkInBy!, week) : undefined };
    if (d.mode === "event") return { ...base, to: d.to?.trim() || undefined, at: toMin(d.depart!, week) };
    return { ...base, from: d.from?.trim(), to: d.to?.trim(), dep: toMin(d.depart!, week), arr: toMin(d.arrive!, week) };
  });
  const companion = meta.companion?.trim() || undefined;
  return {
    traveller: meta.traveller.trim() || "Traveller",
    companion,
    passengers: meta.passengers || (companion ? 2 : 1),
    date: dateLabel(toMin(sortKey(ds[0]), week), week),
    week,
    waitingFor: meta.waitingFor?.trim() ? { name: meta.waitingFor.trim(), relation: "waiting for you" } : undefined,
    defaultConstraints: meta.limits,
    bookings,
  };
}

export function tripToDrafts(trip: Trip): Draft[] {
  const week = trip.week ?? "2026-10-26";
  return trip.bookings.map((b, i) => ({
    id: b.id,
    mode: b.mode,
    title: b.title,
    from: b.from,
    to: b.to,
    depart: b.dep !== undefined ? toLocal(b.dep, week) : b.at !== undefined ? toLocal(b.at, week) : undefined,
    arrive: b.arr !== undefined ? toLocal(b.arr, week) : undefined,
    checkIn: b.mode === "hotel" ? dateOf((b.checkInBy ?? trip.bookings[i - 1]?.arr ?? 1) - 1, week) : undefined,
    checkInBy: b.checkInBy !== undefined ? toLocal(b.checkInBy, week) : undefined,
    price: b.price,
    ref: b.ref,
  }));
}

// A sensible first line for the limits box: arrive in time for the event.
export function suggestLimits(drafts: Draft[]) {
  const e = drafts.find((d) => d.mode === "event" && okTime(d.depart));
  if (!e) return "";
  const at = toMin(e.depart!, weekOf(e.depart!.slice(0, 10)));
  const h = Math.floor((at % 1440) / 60);
  const m = at % 60;
  return `Must reach ${e.to?.split(", ").at(-1) || "the venue"} by ${h % 12 || 12}${m ? `:${String(m).padStart(2, "0")}` : ""}${h < 12 ? "am" : "pm"} ${fmt(at).slice(0, 3)}.`;
}
