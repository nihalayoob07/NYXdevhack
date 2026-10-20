import { runAgent, type AgentEvent } from "@/lib/agent";
import type { Scenario, Trip } from "@/lib/engine";
import { ScenarioSchema, TripSchema } from "@/lib/schema";
import { getScenario, trip as example } from "@/lib/world";

export const maxDuration = 60;

// Streams agent steps as newline-delimited JSON so the UI can show each tool call as it happens.
// Body: { scenarioId } for the example trip, or { trip, scenario } for the traveller's own.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  let t: Trip = example;
  let s: Scenario | undefined = typeof body.scenarioId === "string" ? getScenario(body.scenarioId) : undefined;
  if (!s && body.trip) {
    const tp = TripSchema.safeParse(body.trip);
    const sp = ScenarioSchema.safeParse(body.scenario);
    if (!tp.success || !sp.success) return Response.json({ error: "Invalid trip or scenario" }, { status: 400 });
    t = tp.data;
    s = sp.data;
  }
  if (!s) return Response.json({ error: "Unknown scenario" }, { status: 400 });
  const text = typeof body.constraints === "string" ? body.constraints.slice(0, 600) : "";
  const scenario = s;

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (e: AgentEvent) => controller.enqueue(enc.encode(JSON.stringify(e) + "\n"));
      try {
        await runAgent(t, scenario, text, emit);
      } catch (err) {
        emit({ type: "error", message: err instanceof Error ? err.message : "Agent failed" });
      }
      emit({ type: "done" });
      controller.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" } });
}
