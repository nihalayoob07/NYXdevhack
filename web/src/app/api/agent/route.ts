import { runAgent, type AgentEvent } from "@/lib/agent";
import { getScenario } from "@/lib/world";

export const maxDuration = 60;

// Streams agent steps as newline-delimited JSON so the UI can show each tool call as it happens.
export async function POST(req: Request) {
  const { scenarioId, constraints } = await req.json().catch(() => ({}));
  const s = typeof scenarioId === "string" ? getScenario(scenarioId) : undefined;
  if (!s) return Response.json({ error: "Unknown scenario" }, { status: 400 });
  const text = typeof constraints === "string" ? constraints.slice(0, 600) : "";

  const enc = new TextEncoder();
  const body = new ReadableStream({
    async start(controller) {
      const emit = (e: AgentEvent) => controller.enqueue(enc.encode(JSON.stringify(e) + "\n"));
      try {
        await runAgent(s, text, emit);
      } catch (err) {
        emit({ type: "error", message: err instanceof Error ? err.message : "Agent failed" });
      }
      emit({ type: "done" });
      controller.close();
    },
  });
  return new Response(body, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" } });
}
