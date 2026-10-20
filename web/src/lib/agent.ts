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
  | { type: "mode"; mode: "ai" | "offline" }
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

// Same steps as the AI agent, with the engine's own explanations. Used without an API key
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

The bookings, the broken links and the candidate plan ids are in the first message. Call check_constraints
once with the traveller's limits translated from their own words. Then you will be asked for the recommendation as JSON.

Rules:
- Never state a time, price or connection that a tool did not return. The tools are the source of truth.
- check_constraints decides what is feasible. Never recommend a plan it rules out.
- Explanations are one or two short sentences, written to the traveller, naming the real trade-off
  against the top pick (money, arrival buffer, changes, comfort for their companion). Say "Risky." when
  the buffer before the deadline is under an hour.
- Every claim in an explanation must come from that plan's check_constraints fields: arrives, extra_cost,
  changes, buffer_before_deadline, notes, legs. Quote the real numbers (times, rupees). A leg marked KEEP is
  kept, not lost. A negative extra_cost is a saving: write "saves ₹190", never "-₹190". If a fact is not
  in those fields, leave it out.
- Plain words, no markdown, no em dashes.`;

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";

// Plain JSON Schema, written by hand so any OpenAI-compatible provider accepts it.
const fn = (name: string, description: string, properties: Record<string, object> = {}, required: string[] = []) => ({
  type: "function" as const,
  function: { name, description, parameters: { type: "object", properties, required } },
});

const TOOLS = [
  fn("check_constraints", "Check every candidate plan against the traveller's limits with exact arithmetic. Returns feasibility, arrival buffer, extra cost, notes and a comparable score. Leave out any limit the traveller did not give.", {
    deadline_day: { type: "string", enum: ["Mon", "Tue", "Wed"], description: "Day of the arrival deadline" },
    deadline_time: { type: "string", description: "24h HH:MM" },
    budget_inr: { type: "number", description: "Max extra spend in rupees" },
    no_overnight_bus: { type: "boolean" },
    max_layover_minutes: { type: "number", description: "Longest acceptable idle wait between legs" },
    companion: { type: "string", description: "Who they travel with, if that affects comfort, e.g. 'mum'" },
  }, ["no_overnight_bus"]),
];

// Everything the model returns is parsed, not trusted.
const ConstraintArgs = z.object({
  deadline_day: z.enum(["Mon", "Tue", "Wed"]).nullish(),
  deadline_time: z.string().regex(/^\d{1,2}:\d{2}$/).nullish(),
  budget_inr: z.number().nullish(),
  no_overnight_bus: z.boolean().default(false),
  max_layover_minutes: z.number().nullish(),
  companion: z.string().nullish(),
});
const RecommendArgs = z.object({
  summary: z.string(),
  ranked: z.array(z.object({ plan_id: z.string(), verdict: z.enum(["recommended", "backup", "risky", "ruled-out"]), explanation: z.string() })),
});

type ToolCall = { id: string; function: { name: string; arguments: string } };
type ChatMessage = { role: string; content?: string | null; tool_calls?: ToolCall[]; tool_call_id?: string };

async function runGroq(s: Scenario, text: string, emit: Emit) {
  let constraints: Constraints | null = null;
  const step = (tool: string, t: string) => emit({ type: "step", tool, text: t });
  const planView = (e: Evaluated) => ({
    plan_id: e.plan.id,
    label: e.plan.label,
    legs: e.steps.map((x) => `${x.isNew ? "NEW " : "KEEP "}${x.title}${x.dep !== undefined ? ` ${x.from} ${fmt(x.dep)} → ${x.to} ${fmt(x.arr!)}` : ""}`),
    arrives: fmt(e.arrival),
    extra_cost: rupees(e.extraCost),
    changes: e.changes,
  });

  // The read-only lookups run here instead of as tools: free tiers cap requests a
  // minute (Groq: 8,000 tokens), so the model gets everything up front and a run is two calls. The engine
  // drafts the messages itself, so that is not a model call either.
  step("get_bookings", `Loaded ${trip.bookings.length} linked bookings: ${trip.bookings.map((b) => b.title).join(" → ")}`);
  const bookings = { traveller: trip.traveller, companion: trip.companion, date: trip.date, bookings: trip.bookings.map((b) => ({ ...b, dep: b.dep && fmt(b.dep), arr: b.arr && fmt(b.arr), at: b.at && fmt(b.at), checkInBy: b.checkInBy && fmt(b.checkInBy) })) };
  const nodes = findAffected(trip, s);
  step("find_affected", chainText(nodes));
  const affected = nodes.map((n) => ({ booking: n.leg.title, status: n.status, reason: n.reason }));
  step("search_alternatives", `${s.plans.length} candidate recoveries from live inventory`);
  const loose: Constraints = { deadline: null, budget: null, noOvernightBus: false, maxLayover: null, companion: null };
  const candidates = s.plans.map((p) => planView(evaluatePlan(trip, s, p, loose)));

  const checkConstraints = (args: unknown) => {
    const i = ConstraintArgs.parse(args);
    const [h, m] = (i.deadline_time ?? "").split(":").map(Number);
    constraints = {
      deadline: i.deadline_day && i.deadline_time ? ["Mon", "Tue", "Wed"].indexOf(i.deadline_day) * 1440 + h * 60 + (m || 0) : null,
      budget: i.budget_inr ?? null,
      noOvernightBus: i.no_overnight_bus,
      maxLayover: i.max_layover_minutes ?? null,
      companion: i.companion ?? null,
    };
    emit({ type: "constraints", constraints });
    step("parse_constraints", constraintsText(constraints) || "No hard limits found");
    const ranked = rankPlans(trip, s, constraints);
    step("check_constraints", checkText(ranked));
    return JSON.stringify(ranked.map((e) => ({ ...planView(e), feasible: !e.hardFails.length, ruled_out_because: e.hardFails, buffer_before_deadline: e.buffer === null ? null : dur(e.buffer), notes: e.notes, score: e.score })));
  };

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM },
    {
      role: "user",
      content: `Disruption detected at ${fmt(s.detectedAt)}: ${s.headline}.\nSignals:\n- ${s.signals.join("\n- ")}\n\nBookings: ${JSON.stringify(bookings)}\nAffected: ${JSON.stringify(affected)}\nCandidate plan ids: ${candidates.map((c) => `${c.plan_id} (${c.label})`).join(", ")}. check_constraints returns their full details.\n\nThe traveller's limits, in their own words: "${text}"\n\nRepair the trip.`,
    },
  ];

  const groq = async (extra: object): Promise<ChatMessage | undefined> => {
    const call = () =>
      fetch(GROQ_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
        body: JSON.stringify({ model: GROQ_MODEL, messages, temperature: 0.2, reasoning_effort: "low", ...extra }),
        signal: AbortSignal.timeout(30_000),
      });
    let res = await call();
    // Free tier: 8,000 tokens a minute. A short wait beats dropping to the built-in planner.
    const retryAfter = Number(res.headers.get("retry-after"));
    if (res.status === 429 && retryAfter > 0 && retryAfter <= 8) {
      step("rate_limit", `Free tier is busy, retrying in ${Math.ceil(retryAfter)}s`);
      await pause(retryAfter * 1000);
      res = await call();
    }
    if (!res.ok) throw new Error(`Groq ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return (await res.json()).choices?.[0]?.message;
  };

  // Exactly two requests. 1: the model turns the traveller's words into limits and the engine checks
  // every plan against them.
  const first = await groq({ tools: TOOLS, tool_choice: { type: "function", function: { name: "check_constraints" } } });
  const toolCall = first?.tool_calls?.[0];
  if (!first || !toolCall) throw new Error("Model did not call check_constraints");
  messages.push(first);
  messages.push({ role: "tool", tool_call_id: toolCall.id, content: checkConstraints(JSON.parse(toolCall.function.arguments || "{}")) });

  // 2: it explains the engine's results. JSON mode, because Groq rejects forced tool calls that the
  // model formats loosely, which happened with the nested ranked array.
  const order = rankPlans(trip, s, constraints ?? parseConstraints(text)).map((e) => e.plan.id);
  messages.push({
    role: "user",
    content: `Now reply with JSON only: {"summary": one sentence on what happened and what you recommend, "ranked": [{"plan_id", "verdict": "recommended" | "backup" | "risky" | "ruled-out", "explanation"}]}. Use exactly this order, best first: ${order.join(", ")}. Recommend ${order[0]} in the summary. Only say "Risky." when buffer_before_deadline is under 1h.`,
  });
  const second = await groq({ response_format: { type: "json_object" } });
  const rec = RecommendArgs.safeParse(JSON.parse(second?.content ?? "null"));
  const out = { result: rec.success ? { summary: rec.data.summary, ranked: rec.data.ranked.map((r) => ({ planId: r.plan_id, verdict: r.verdict, explanation: r.explanation })) } : null };

  // The engine has the final say on feasibility, whatever the model wrote.
  const c = constraints ?? parseConstraints(text);
  const ranked = rankPlans(trip, s, c);
  step("build_itinerary", `Top pick: ${ranked[0].plan.label}`);
  step("draft_messages", `${draftActions(trip, s, ranked[0]).length} messages drafted, waiting for your approval`);
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
  if (!process.env.GROQ_API_KEY) {
    emit({ type: "mode", mode: "offline" });
    return runOffline(s, text, emit);
  }
  emit({ type: "mode", mode: "ai" });
  try {
    await runGroq(s, text, emit);
  } catch (err) {
    console.error("agent failed, falling back to the built-in planner", err);
    emit({ type: "step", tool: "fallback", text: "The AI didn't answer in time, finishing with the built-in planner" });
    await runOffline(s, text, emit, true);
  }
}
