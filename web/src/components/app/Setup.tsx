"use client";
import { useState } from "react";
import { motion } from "motion/react";
import { MagicWand, Plus, Trash } from "@phosphor-icons/react";
import type { Mode, Trip } from "@/lib/engine";
import { draftProblem, draftsToTrip, newId, suggestLimits, tripToDrafts, type Draft } from "@/lib/recover";
import { saveTrip } from "@/lib/store";
import { trip as example } from "@/lib/world";
import { ICON } from "./Ticket";
import { Button, Eyebrow, Field, Panel, input } from "./ui";

const MODES: Mode[] = ["flight", "train", "bus", "cab", "hotel", "event"];
const PLACEHOLDER: Record<Mode, string> = {
  flight: "IndiGo 6E 2417",
  train: "Mysuru Intercity 16557",
  bus: "KSRTC Airavat",
  cab: "Uber to Mysuru",
  hotel: "The Chamundi Courtyard",
  event: "Kavya's wedding",
};
const SAMPLE = `IndiGo booking confirmed. PNR K7QX2M. 6E 2417 Delhi (DEL) 26 Oct 2026 15:40 to Bengaluru (BLR) 18:30. 2 adults. Total ₹13,680.
IRCTC: PNR 4318562907, 16557 Mysuru Intercity, KSR Bengaluru 20:30 → Mysuru Jn 23:05 on 26-Oct-2026, CC, 2 passengers, ₹770.
...`;

// One booking's fields. Also used for "I found an option".
export function LegFields({ d, onChange }: { d: Draft; onChange: (d: Draft) => void }) {
  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    onChange({ ...d, [k]: k === "price" ? (e.target.value ? Number(e.target.value) : undefined) : e.target.value });
  const transport = d.mode !== "hotel" && d.mode !== "event";
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <Field label="Type">
        <select value={d.mode} onChange={set("mode")} className={input}>
          {MODES.map((m) => (
            <option key={m} value={m}>
              {m[0].toUpperCase() + m.slice(1)}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Name" className="sm:col-span-3">
        <input value={d.title} onChange={set("title")} placeholder={PLACEHOLDER[d.mode]} className={input} />
      </Field>
      {transport && (
        <>
          <Field label="From" className="sm:col-span-2">
            <input value={d.from ?? ""} onChange={set("from")} placeholder="Delhi DEL" className={input} />
          </Field>
          <Field label="To" className="sm:col-span-2">
            <input value={d.to ?? ""} onChange={set("to")} placeholder="Bengaluru BLR" className={input} />
          </Field>
          <Field label="Departs" className="sm:col-span-2">
            <input type="datetime-local" value={d.depart ?? ""} onChange={set("depart")} className={input} />
          </Field>
          <Field label="Arrives" className="sm:col-span-2">
            <input type="datetime-local" value={d.arrive ?? ""} onChange={set("arrive")} className={input} />
          </Field>
        </>
      )}
      {d.mode === "hotel" && (
        <>
          <Field label="City" className="sm:col-span-2">
            <input value={d.to ?? ""} onChange={set("to")} placeholder="Mysuru" className={input} />
          </Field>
          <Field label="Check-in night">
            <input type="date" value={d.checkIn?.slice(0, 10) ?? ""} onChange={set("checkIn")} className={input} />
          </Field>
          <Field label="Desk closes (optional)">
            <input type="datetime-local" value={d.checkInBy ?? ""} onChange={set("checkInBy")} className={input} />
          </Field>
        </>
      )}
      {d.mode === "event" && (
        <>
          <Field label="Where" className="sm:col-span-2">
            <input value={d.to ?? ""} onChange={set("to")} placeholder="Kalyana Mantapa, Mysuru" className={input} />
          </Field>
          <Field label="Starts" className="sm:col-span-2">
            <input type="datetime-local" value={d.depart ?? ""} onChange={set("depart")} className={input} />
          </Field>
        </>
      )}
      {d.mode !== "event" && (
        <>
          <Field label="Price, total ₹">
            <input type="number" min={0} inputMode="numeric" value={d.price ?? ""} onChange={set("price")} className={input} />
          </Field>
          <Field label="PNR / ref">
            <input value={d.ref ?? ""} onChange={set("ref")} className={input} />
          </Field>
        </>
      )}
    </div>
  );
}

const blank = (mode: Mode = "flight"): Draft => ({ id: newId("m"), mode, title: "" });

export function Setup({ editing, onDone }: { editing?: Trip; onDone?: () => void }) {
  const [paste, setPaste] = useState("");
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>(editing ? tripToDrafts(editing) : []);
  const [traveller, setTraveller] = useState(editing?.traveller ?? "");
  const [companion, setCompanion] = useState(editing?.companion ?? "");
  const [pax, setPax] = useState(editing?.passengers ?? 1);
  const [waiting, setWaiting] = useState(editing?.waitingFor?.name ?? "");
  const [limits, setLimits] = useState(editing?.defaultConstraints ?? "");

  const read = async () => {
    setReading(true);
    setError(null);
    try {
      const res = await fetch("/api/parse", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: paste, today: new Date().toISOString() }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't read that");
      setDrafts((d) => [...d, ...data.bookings]);
      if (data.traveller && !traveller) setTraveller(data.traveller);
      if (data.passengers) setPax(data.passengers);
      if (!limits) setLimits(suggestLimits(data.bookings));
      setPaste("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read that");
      if (!drafts.length) setDrafts([blank()]);
    }
    setReading(false);
  };

  const problems = drafts.map(draftProblem);
  const ready = drafts.length > 0 && problems.every((p) => !p);
  const save = () => {
    const trip = draftsToTrip(drafts, { traveller, companion, passengers: pax, waitingFor: waiting, limits: limits || suggestLimits(drafts) });
    saveTrip({ trip });
    onDone?.();
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 md:px-8 md:py-12">
      <Eyebrow>{editing ? "Edit trip" : "New trip"}</Eyebrow>
      <h1 className="mt-1.5 text-4xl font-bold leading-[1.05] md:text-5xl">{editing ? "Your bookings" : "Where are you headed?"}</h1>
      <p className="mt-3 max-w-[52ch] text-muted">
        {editing ? "Fix anything that changed. Travv checks the whole chain again." : "Paste your booking confirmations. Travv reads them into one chain, watches every link, and repairs the trip when one breaks."}
      </p>

      <div className="mt-8 space-y-6">
        <Panel title="Paste your bookings" aside={<MagicWand size={20} aria-hidden className="text-muted" />}>
          <textarea
            aria-label="Booking confirmations"
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            rows={6}
            placeholder={SAMPLE}
            className={`${input} resize-y leading-relaxed`}
          />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button onClick={read} disabled={reading || paste.trim().length < 20}>
              {reading ? "Reading…" : "Read my bookings"}
            </Button>
            <Button kind="quiet" onClick={() => setDrafts((d) => [...d, blank(d.length ? "train" : "flight")])}>
              Add by hand instead
            </Button>
          </div>
          {error && <p className="mt-3 text-sm font-semibold text-bad">{error}</p>}
          <p className="mt-3 text-xs text-muted">Emails, SMS or e-tickets, as many as you like. The AI only reads them; you check everything before it&apos;s saved.</p>
        </Panel>

        {drafts.length > 0 && (
          <Panel title="Check your bookings" aside={<span className="typed text-xs text-muted">{drafts.length} found</span>}>
            <ol className="space-y-3">
              {drafts.map((d, i) => {
                const Ico = ICON[d.mode];
                return (
                  <motion.li key={d.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-[14px] bg-surface p-3 shadow-[0_2px_0_var(--edge)] md:p-4">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 text-sm font-semibold">
                        <Ico size={18} aria-hidden /> {d.title || `Booking ${i + 1}`}
                      </span>
                      <button type="button" onClick={() => setDrafts((all) => all.filter((x) => x.id !== d.id))} aria-label={`Remove ${d.title || "booking"}`} className="p-1 text-muted hover:text-bad">
                        <Trash size={16} aria-hidden />
                      </button>
                    </div>
                    <LegFields d={d} onChange={(n) => setDrafts((all) => all.map((x) => (x.id === d.id ? n : x)))} />
                    {problems[i] && <p className="mt-2 text-xs font-semibold text-bad">{problems[i]}</p>}
                  </motion.li>
                );
              })}
            </ol>
            <Button kind="line" className="mt-3" onClick={() => setDrafts((d) => [...d, blank("train")])}>
              <Plus size={16} aria-hidden /> Add a booking
            </Button>
          </Panel>
        )}

        {drafts.length > 0 && (
          <Panel title="About your trip">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Your name">
                <input value={traveller} onChange={(e) => setTraveller(e.target.value)} className={input} />
              </Field>
              <Field label="People travelling">
                <input type="number" min={1} max={20} value={pax} onChange={(e) => setPax(Math.max(1, Number(e.target.value) || 1))} className={input} />
              </Field>
              <Field label="Travelling with (optional)">
                <input value={companion} onChange={(e) => setCompanion(e.target.value)} placeholder="my mother, 68" className={input} />
              </Field>
              <Field label="Who's waiting for you (optional)">
                <input value={waiting} onChange={(e) => setWaiting(e.target.value)} placeholder="Meera" className={input} />
              </Field>
              <Field label="Your limits, in your own words" className="sm:col-span-2">
                <textarea
                  value={limits}
                  onChange={(e) => setLimits(e.target.value)}
                  rows={3}
                  placeholder="Must reach Mysuru by 9am Tuesday, max ₹4,000 extra, no overnight buses. Travelling with my mum, who can't do long layovers."
                  className={`${input} resize-none leading-relaxed`}
                />
              </Field>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button onClick={save} disabled={!ready}>
                {editing ? "Save changes" : "Watch my trip"}
              </Button>
              {editing && (
                <Button kind="quiet" onClick={onDone}>
                  Cancel
                </Button>
              )}
              {!ready && <span className="text-xs text-muted">Fill in the missing details above first.</span>}
            </div>
          </Panel>
        )}

        {!editing && (
          <p className="text-center text-sm text-muted">
            Just looking?{" "}
            <button type="button" onClick={() => saveTrip({ trip: example, example: true })} className="font-semibold text-text underline underline-offset-4">
              Try an example trip
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
