"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { draftActions, findAffected, fmt, parseConstraints, rankPlans, rupees, type Scenario } from "@/lib/engine";
import { trip } from "@/lib/world";

type Msg = { from: "domino" | "me"; text: string };
type Stage = "choose" | "confirm" | "done";

const orList = (n: number) => Array.from({ length: n }, (_, i) => i + 1).join(", ").replace(/, (\d)$/, " or $1");

export function StrandedChat({ s }: { s: Scenario }) {
  const c = useMemo(() => parseConstraints(trip.defaultConstraints), []);
  const options = useMemo(() => rankPlans(trip, s, c).filter((e) => !e.hardFails.length).slice(0, 3), [s, c]);
  const opening = useMemo<Msg[]>(() => {
    const hit = findAffected(trip, s).filter((n) => n.status !== "ok" && n.status !== "delayed");
    return [
      { from: "domino", text: `${s.headline}${s.airlineAnnouncesAt ? " (IndiGo hasn't announced it yet)" : ""}. This breaks: ${hit.map((n) => n.leg.title).join(", ")}.` },
      {
        from: "domino",
        text: `${options.map((e, i) => `${i + 1}  ${e.plan.label}. Arrive ${fmt(e.arrival)}, ${e.extraCost <= 0 ? `save ${rupees(-e.extraCost)}` : `+${rupees(e.extraCost)}`}`).join("\n")}\n\nReply ${orList(options.length)}.`,
      },
    ];
  }, [s, options]);

  const [msgs, setMsgs] = useState<Msg[]>(opening);
  const [stage, setStage] = useState<Stage>("choose");
  const [pick, setPick] = useState<number | null>(null);
  const [typing, setTyping] = useState(false);
  const [input, setInput] = useState("");
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs, typing]);

  const say = (text: string) => {
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      setMsgs((m) => [...m, { from: "domino", text }]);
    }, 650);
  };

  const reply = (raw: string) => {
    const t = raw.trim().toUpperCase();
    if (!t) return;
    setMsgs((m) => [...m, { from: "me", text: raw.trim() }]);
    setInput("");
    if (stage === "choose") {
      const n = Number(t) - 1;
      if (!options[n]) return say(`Reply ${orList(options.length)}.`);
      const e = options[n];
      const acts = draftActions(trip, s, e);
      setPick(n);
      setStage("confirm");
      return say(`Done. ${e.plan.label}. You reach Mysuru ${fmt(e.arrival)}.\n\nI drafted ${acts.length} messages:\n${acts.map((a) => `- ${a.title}`).join("\n")}\n\nReply S to send all, or V to read one first.`);
    }
    if (stage === "confirm" && pick !== null) {
      const e = options[pick];
      const acts = draftActions(trip, s, e);
      if (t === "V") return say(acts.find((a) => a.kind === "claim" || a.kind === "refund")?.body ?? acts[0].body);
      if (t === "S") {
        setStage("done");
        return say(`Sent (demo). ${trip.waitingFor?.name ?? "Your family"} knows you arrive around ${fmt(e.arrival).slice(4)}. Safe travels.`);
      }
      return say("Reply S to send all, or V to read one.");
    }
    say("All done. Open the full demo for details.");
  };

  const quick = stage === "choose" ? options.map((_, i) => String(i + 1)) : stage === "confirm" ? ["S", "V"] : [];

  return (
    <div className="flex h-[min(720px,calc(100dvh-10rem))] flex-col overflow-hidden rounded-[22px] bg-surface shadow-[0_2px_0_var(--edge),0_30px_50px_-40px_rgb(60_40_20/0.55)]">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div>
          <p className="serif font-bold leading-tight">Domino</p>
          <p className="text-xs text-muted">Travel assistant, replies in seconds</p>
        </div>
        <p className="rounded-full border border-bad/50 px-2 py-0.5 font-mono text-xs text-bad" aria-label="Phone battery 8 percent">
          8%
        </p>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-4" aria-live="polite">
        {msgs.map((m, i) => (
          <div key={i} className={`bubble-in flex ${m.from === "me" ? "justify-end" : ""}`}>
            <p
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${m.from === "me" ? "rounded-br-md bg-accent text-on-accent" : "rounded-bl-md bg-surface-2"}`}
            >
              {m.text}
            </p>
          </div>
        ))}
        {typing && (
          <div className="bubble-in flex" aria-label="Domino is typing">
            <p className="rounded-2xl rounded-bl-md bg-surface-2 px-3.5 py-2.5 text-sm text-muted">typing…</p>
          </div>
        )}
        <div ref={end} />
      </div>
      {quick.length > 0 && (
        <div className="flex gap-2 px-4 pb-2">
          {quick.map((q) => (
            <button key={q} type="button" onClick={() => reply(q)} className="min-w-12 rounded-full border border-line px-4 py-2 font-mono text-sm transition active:scale-[0.96]">
              {q}
            </button>
          ))}
        </div>
      )}
      <form
        className="flex gap-2 border-t border-line p-3"
        onSubmit={(e) => {
          e.preventDefault();
          reply(input);
        }}
      >
        <label htmlFor="reply" className="sr-only">
          Your reply
        </label>
        <input
          id="reply"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type 1, 2 or 3…"
          autoComplete="off"
          className="min-w-0 flex-1 rounded-full border border-line bg-bg px-4 py-2 text-sm text-text placeholder:text-muted focus:border-accent focus:outline-none"
        />
        <button type="submit" className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-on-accent transition active:scale-[0.96]">
          Send
        </button>
      </form>
    </div>
  );
}
