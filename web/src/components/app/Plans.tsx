"use client";
import { motion } from "motion/react";
import { CheckCircle } from "@phosphor-icons/react";
import { fmt, rupees, type Evaluated } from "@/lib/engine";
import type { Verdict } from "@/lib/agent";

const VERDICT: Record<Verdict, { label: string; style: React.CSSProperties }> = {
  recommended: { label: "Best", style: { background: "var(--good)", color: "var(--card)" } },
  backup: { label: "Backup", style: { background: "var(--surface-2)", color: "var(--muted)" } },
  risky: { label: "Risky", style: { background: "var(--bad)", color: "var(--card)" } },
  "ruled-out": { label: "Ruled out", style: { background: "color-mix(in oklab, var(--bad) 14%, transparent)", color: "var(--bad)" } },
};

export interface PlanRow {
  e: Evaluated;
  verdict: Verdict;
  explanation: string;
}

export function Plans({ rows, selected, onSelect }: { rows: PlanRow[]; selected: string | null; onSelect: (id: string) => void }) {
  const ok = rows.filter((r) => r.verdict !== "ruled-out");
  const out = rows.filter((r) => r.verdict === "ruled-out");
  return (
    <div>
      <div role="radiogroup" aria-label="Recovery options" className="grid gap-3">
        {ok.map((r, i) => {
          const on = selected === r.e.plan.id;
          return (
            <motion.button
              key={r.e.plan.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onSelect(r.e.plan.id)}
              layout
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0, rotate: on ? -0.6 : 0 }}
              transition={{ duration: 0.5, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
              whileTap={{ scale: 0.99 }}
              className={`group relative w-full rounded-[14px] border-2 bg-surface p-4 text-left shadow-[0_2px_0_var(--edge)] transition-colors md:p-5 ${on ? "border-text" : "border-transparent hover:border-line"}`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="typed text-xs text-muted">{String.fromCharCode(65 + i)}</span>
                <span className="typed rounded px-2 py-0.5 text-[11px] font-bold" style={VERDICT[r.verdict].style}>
                  {VERDICT[r.verdict].label}
                </span>
                {on && <CheckCircle size={18} weight="fill" className="ml-auto text-text" aria-hidden />}
              </div>
              <p className="serif mt-2 text-lg font-bold">{r.e.plan.label}</p>
              <dl className="mt-3 grid grid-cols-3 gap-2 text-[15px] font-bold tabular">
                <div>
                  <dt className="text-xs font-normal text-muted">Arrive</dt>
                  <dd>{fmt(r.e.arrival)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-normal text-muted">{r.e.extraCost < 0 ? "You get back" : "Extra"}</dt>
                  <dd style={{ color: r.e.extraCost <= 0 ? "var(--good)" : undefined }}>{rupees(Math.abs(r.e.extraCost))}</dd>
                </div>
                <div>
                  <dt className="text-xs font-normal text-muted">Changes</dt>
                  <dd>{r.e.changes}</dd>
                </div>
              </dl>
              <p className="mt-3 text-sm leading-relaxed text-text/85">{r.explanation}</p>
              {r.e.notes.length > 0 && (
                <ul className="mt-2 space-y-1 text-xs text-muted">
                  {r.e.notes.slice(0, 3).map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              )}
            </motion.button>
          );
        })}
      </div>
      {out.length > 0 && (
        <details className="group mt-4 rounded-[14px] border-2 border-dashed border-line px-4 py-3">
          <summary className="cursor-pointer text-sm text-muted">
            {out.length} option{out.length > 1 ? "s" : ""} ruled out by your limits
          </summary>
          <ul className="mt-3 space-y-3">
            {out.map((r) => (
              <li key={r.e.plan.id} className="text-sm">
                <p className="font-medium">{r.e.plan.label}</p>
                <p className="text-bad">{r.e.hardFails.join(". ")}</p>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
