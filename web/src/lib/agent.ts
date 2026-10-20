import Anthropic from "@anthropic-ai/sdk";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import {
  draftActions,
  dur,
  evaluatePlan,
  explain,
  findAffected,
  fmt,
  parseConstraints,
  rankPlans,
  rupees,
  type ChainNode,
  type Constraints,
  type Evaluated,
  type Scenario,
} from "./engine";
import { trip } from "./world";

export type Verdict = "recommended" | "backup" | "risky" | "ruled-out";
export type AgentEvent =
  | { type: "mode"; mode: "claude" | "offline" }
  | { type: "step"; tool: string; text: string }
  | { type: "constraints"; constraints: Constraints }
  | { type: "result"; summary: string; ranked: { planId: string; verdict: Verdict; explanation: string }[] }
  | { type: "error"; message: string }
  | { type: "done" };

type Emit = (e: AgentEvent) => void;

const chainText = (nodes: ChainNode[]) =>
  nodes.filter((n) => n.status !== "ok").map((n) => `${n.leg.title}: ${n.reason}`).join(" → ");

const checkText = (ranked: Evaluated[]) => {
  const out = ranked.filter((r) => r.hardFails.length);
  return `${ranked.length - out.length} pass, ${out.length} ruled out${out.length ? ` (${out.map((r) => r.hardFails[0].toLowerCase()).join("; ")})` : ""}`;
};

const constraintsText = (c: Constraints) =>
  [
    c.deadline !== null && `arrive by ${fmt(c.deadline)}`,
    c.budget !== null && `max ${rupees(c.budget)} extra`,
    c.noOvernightBus && "no overnight buses",
    c.maxLayover !== null && `waits under ${dur(c.maxLayover)}`,
    c.companion && `comfort for ${c.companion}`,
  ]
    .filter(Boolean)
    .join(", ");

function verdictOf(e: Evaluated, i: number): Verdict {
  if (e.hardFails.length) return "ruled-out";
  if (i === 0) return "recommended";
  return e.risky ? "risky" : "backup";
}

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Same steps as the Claude agent, with the engine's own explanations. Used without an API key
// and as the safety net if the API call fails mid-demo.
async function runOffline(s: Scenario, text: string, emit: Emit, fast = false) {
  const wait = (ms: number) => (fast ? Promise.resolve() : pause(ms));
  emit({ type: "step", tool: "get_bookings", text: `Loaded ${trip.bookings.length} linked bookings: ${trip.bookings.map((b) => b.title).join(" → ")}` });
  await wait(500);
  emit({ type: "step", tool: "find_affected", text: chainText(findAffected(trip, s)) });
  await wait(650);
  const c = parseConstraints(text);
  emit({ type: "constraints", constraints: c });
  emit({ type: "step", tool: "parse_constraints", text: constraintsText(c) || "No hard limits found" });
  await wait(550);
  emit({ type: "step", tool: "search_alternatives", text: `${s.plans.length} candidate recoveries from live inventory` });
  await wait(600);
  const ranked = rankPlans(trip, s, c);
  emit({ type: "step", tool: "check_constraints", text: checkText(ranked) });
  await wait(550);
  emit({ type: "step", tool: "build_itinerary", text: `Top pick: ${ranked[0].plan.label}` });
  await wait(450);
  emit({ type: "step", tool: "draft_messages", text: `${draftActions(trip, s, ranked[0]).length} messages drafted, waiting for your approval` });
  emit({
    type: "result",
    summary: `${s.headline}. ${ranked[0].plan.label} gets you to Mysuru ${fmt(ranked[0].arrival)}.`,
    ranked: ranked.map((e, i) => ({ planId: e.plan.id, verdict: verdictOf(e, i), explanation: explain(e, ranked[0], c) })),
  });
}

const SYSTEM = `You are Domino, an agent that repairs a traveller's whole trip after a disruption.
The trip is a chain of linked bookings; one broken link can break the ones after it.

Work in this order: get_bookings, find_affected, search_alternatives, then check_constraints with the
traveller's limits translated from their own words, then build_itinerary and draft_messages for your top pick,
then present_recommendation once.

Rules:
- Never state a time, price or connection that a tool did not return. The tools are the source of truth.
- check_constraints decides what is feasible. Never recommend a plan it rules out.
- Explanations are one or two short sentences, written to the traveller, naming the real trade-off
  against the top pick (money, arrival buffer, changes, comfort for their companion). Say "Risky." when
  the buffer before the deadline is under an hour.
- Plain words, no markdown, no em dashes.`;

async function runClaude(s: Scenario, text: string, emit: Emit) {
  const client = new Anthropic();
  let constraints: Constraints | null = null;
  const out: { result: Extract<AgentEvent, { type: "result" }> | null } = { result: null }; // set inside a tool callback
  const step = (tool: string, t: string) => emit({ type: "step", tool, text: t });
  const planView = (e: Evaluated) => ({
    plan_id: e.plan.id,
    label: e.plan.label,
    legs: e.steps.map((x) => `${x.isNew ? "NEW " : "KEEP "}${x.title}${x.dep !== undefined ? ` ${x.from} ${fmt(x.dep)} → ${x.to} ${fmt(x.arr!)}` : ""}`),
    arrives: fmt(e.arrival),
    extra_cost: rupees(e.extraCost),
    changes: e.changes,
  });

  const tools = [
    betaZodTool({
      name: "get_bookings",
      description: "The traveller's linked bookings in order, with times.",
      inputSchema: z.object({}),
      run: async () => {
        step("get_bookings", `Loaded ${trip.bookings.length} linked bookings: ${trip.bookings.map((b) => b.title).join(" → ")}`);
        return JSON.stringify({ traveller: trip.traveller, companion: trip.companion, date: trip.date, bookings: trip.bookings.map((b) => ({ ...b, dep: b.dep && fmt(b.dep), arr: b.arr && fmt(b.arr), at: b.at && fmt(b.at), checkInBy: b.checkInBy && fmt(b.checkInBy) })) });
      },
    }),
    betaZodTool({
      name: "find_affected",
      description: "Walk the booking chain under the current disruption and report which links break.",
      inputSchema: z.object({}),
      run: async () => {
        const nodes = findAffected(trip, s);
        step("find_affected", chainText(nodes));
        return JSON.stringify(nodes.map((n) => ({ booking: n.leg.title, status: n.status, reason: n.reason })));
      },
    }),
    betaZodTool({
      name: "search_alternatives",
      description: "Candidate recovery plans from current inventory, each a full chain from Delhi to Mysuru.",
      inputSchema: z.object({}),
      run: async () => {
        step("search_alternatives", `${s.plans.length} candidate recoveries from live inventory`);
        const loose: Constraints = { deadline: null, budget: null, noOvernightBus: false, maxLayover: null, companion: null };
        return JSON.stringify(s.plans.map((p) => planView(evaluatePlan(trip, s, p, loose))));
      },
    }),
    betaZodTool({
      name: "check_constraints",
      description: "Check every candidate plan against the traveller's limits with exact arithmetic. Returns feasibility, arrival buffer, extra cost, notes and a comparable score.",
      inputSchema: z.object({
        deadline_day: z.enum(["Mon", "Tue", "Wed"]).nullable().describe("Day of the arrival deadline, or null if none"),
        deadline_time: z.string().nullable().describe("24h HH:MM, or null"),
        budget_inr: z.number().nullable().describe("Max extra spend in rupees, or null"),
        no_overnight_bus: z.boolean(),
        max_layover_minutes: z.number().nullable().describe("Longest acceptable idle wait between legs, or null"),
        companion: z.string().nullable().describe("Who they travel with, if that affects comfort, e.g. 'mum'"),
      }),
      run: async (i) => {
        const [h, m] = (i.deadline_time ?? "").split(":").map(Number);
        constraints = {
          deadline: i.deadline_day && i.deadline_time ? ["Mon", "Tue", "Wed"].indexOf(i.deadline_day) * 1440 + h * 60 + (m || 0) : null,
          budget: i.budget_inr,
          noOvernightBus: i.no_overnight_bus,
          maxLayover: i.max_layover_minutes,
          companion: i.companion,
        };
        emit({ type: "constraints", constraints });
        step("parse_constraints", constraintsText(constraints) || "No hard limits found");
        const ranked = rankPlans(trip, s, constraints);
        step("check_constraints", checkText(ranked));
        return JSON.stringify(ranked.map((e) => ({ ...planView(e), feasible: !e.hardFails.length, ruled_out_because: e.hardFails, buffer_before_deadline: e.buffer === null ? null : dur(e.buffer), notes: e.notes, score: e.score })));
      },
    }),
    betaZodTool({
      name: "build_itinerary",
      description: "Full step-by-step itinerary for one plan.",
      inputSchema: z.object({ plan_id: z.string() }),
      run: async ({ plan_id }) => {
        const p = s.plans.find((x) => x.id === plan_id);
        if (!p || !constraints) return "Unknown plan, or check_constraints has not run yet.";
        step("build_itinerary", `Top pick: ${p.label}`);
        return JSON.stringify(planView(evaluatePlan(trip, s, p, constraints)));
      },
    }),
    betaZodTool({
      name: "draft_messages",
      description: "Draft the refund requests, compensation claims, hotel and family messages for one plan. They wait for the traveller's approval.",
      inputSchema: z.object({ plan_id: z.string() }),
      run: async ({ plan_id }) => {
        const p = s.plans.find((x) => x.id === plan_id);
        if (!p || !constraints) return "Unknown plan, or check_constraints has not run yet.";
        const actions = draftActions(trip, s, evaluatePlan(trip, s, p, constraints));
        step("draft_messages", `${actions.length} messages drafted, waiting for your approval`);
        return JSON.stringify(actions.map((a) => a.title));
      },
    }),
    betaZodTool({
      name: "present_recommendation",
      description: "Show the ranked options to the traveller. Call once, last. Include every plan, best first.",
      inputSchema: z.object({
        summary: z.string().describe("One sentence: what happened and what you recommend"),
        ranked: z.array(z.object({ plan_id: z.string(), verdict: z.enum(["recommended", "backup", "risky", "ruled-out"]), explanation: z.string() })),
      }),
      run: async (i) => {
        out.result = { type: "result", summary: i.summary, ranked: i.ranked.map((r) => ({ planId: r.plan_id, verdict: r.verdict, explanation: r.explanation })) };
        return "Shown to the traveller.";
      },
    }),
  ];

  const final = await client.beta.messages.toolRunner({
    model: "claude-opus-5-5",
    max_tokens: 16000,
    max_iterations: 14,
    output_config: { effort: "low" }, // a live demo needs answers in seconds; the engine does the hard checking
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SYSTEM,
    tools,
    messages: [
      {
        role: "user",
        content: `Disruption detected at ${fmt(s.detectedAt)}: ${s.headline}.\nSignals:\n- ${s.signals.join("\n- ")}\n\nThe traveller's limits, in their own words: "${text}"\n\nRepair the trip.`,
      },
    ],
  });
  if (final.stop_reason === "refusal") throw new Error("Claude declined this request");

  // The engine has the final say on feasibility, whatever the model wrote.
  const c = constraints ?? parseConstraints(text);
  const ranked = rankPlans(trip, s, c);
  const said = new Map(out.result?.ranked.map((r) => [r.planId, r]) ?? []);
  emit({
    type: "result",
    summary: out.result?.summary ?? `${s.headline}. ${ranked[0].plan.label} is the best option.`,
    ranked: ranked.map((e, i) => ({
      planId: e.plan.id,
      verdict: verdictOf(e, i),
      explanation: e.hardFails.length ? explain(e, ranked[0], c) : (said.get(e.plan.id)?.explanation ?? explain(e, ranked[0], c)),
    })),
  });
}

export async function runAgent(s: Scenario, text: string, emit: Emit) {
  if (!process.env.ANTHROPIC_API_KEY) {
    emit({ type: "mode", mode: "offline" });
    return runOffline(s, text, emit);
  }
  emit({ type: "mode", mode: "claude" });
  try {
    await runClaude(s, text, emit);
  } catch (err) {
    console.error("agent failed, falling back to the built-in planner", err);
    emit({ type: "step", tool: "fallback", text: "Claude didn't answer in time, finishing with the built-in planner" });
    await runOffline(s, text, emit, true);
  }
}
