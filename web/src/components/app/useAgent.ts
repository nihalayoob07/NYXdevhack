"use client";
import { useCallback, useRef, useState } from "react";
import type { AgentEvent } from "@/lib/agent";
import type { Constraints } from "@/lib/engine";

export interface AgentState {
  running: boolean;
  mode: "ai" | "offline" | null;
  steps: { tool: string; text: string }[];
  constraints: Constraints | null;
  result: Extract<AgentEvent, { type: "result" }> | null;
  error: string | null;
}

const EMPTY: AgentState = { running: false, mode: null, steps: [], constraints: null, result: null, error: null };

// Reads the NDJSON stream from /api/agent into state, one event per line.
export function useAgent() {
  const [state, setState] = useState<AgentState>(EMPTY);
  const abort = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    abort.current?.abort();
    setState(EMPTY);
  }, []);

  // body: { scenarioId, constraints } for the example trip, or { trip, scenario, constraints }.
  const run = useCallback(async (body: Record<string, unknown>) => {
    abort.current?.abort();
    const ctrl = (abort.current = new AbortController());
    setState({ ...EMPTY, running: true });
    const apply = (e: AgentEvent) =>
      setState((s) => {
        switch (e.type) {
          case "mode":
            return { ...s, mode: e.mode };
          case "step":
            return { ...s, steps: [...s.steps, { tool: e.tool, text: e.text }] };
          case "constraints":
            return { ...s, constraints: e.constraints };
          case "result":
            return { ...s, result: e };
          case "error":
            return { ...s, error: e.message };
          case "done":
            return { ...s, running: false };
        }
      });
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) throw new Error(`Agent request failed (${res.status})`);
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += value;
        const lines = buf.split("\n");
        buf = lines.pop()!;
        lines.filter(Boolean).forEach((l) => apply(JSON.parse(l)));
      }
    } catch (err) {
      if (ctrl.signal.aborted) return;
      setState((s) => ({ ...s, running: false, error: err instanceof Error ? err.message : "Agent failed" }));
    }
  }, []);

  return { ...state, run, reset };
}
