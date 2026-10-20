"use client";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowsClockwise, Bed, ChatCircleText, Check, CopySimple, Receipt, Scales, type Icon } from "@phosphor-icons/react";
import type { Action } from "@/lib/engine";

// Where "Send" takes the traveller: WhatsApp for people, their email app for companies. Bookings they make themselves.
function sendUrl(a: Action) {
  if (a.kind === "rebook") return null;
  if (a.kind === "notify") return `https://wa.me/?text=${encodeURIComponent(a.body)}`;
  const subject = a.body.match(/^Subject: (.*)\n/)?.[1] ?? a.title;
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(a.body.replace(/^Subject: .*\n\n?/, ""))}`;
}

const ICON: Record<Action["kind"], Icon> = { rebook: ArrowsClockwise, refund: Receipt, claim: Scales, hotel: Bed, notify: ChatCircleText };

export function Actions({ actions }: { actions: Action[] }) {
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<string | null>(actions.find((a) => a.kind === "claim")?.id ?? null);
  const [copied, setCopied] = useState<string | null>(null);
  const mark = (id: string) => setSent((s) => new Set(s).add(id));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted" aria-live="polite">
          <span className="typed tabular text-text">{sent.size}</span> of {actions.length} done
        </p>
      </div>
      <ul className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-2">
        {actions.map((a, i) => {
          const Ico = ICON[a.kind];
          const done = sent.has(a.id);
          const expanded = open === a.id;
          return (
            <motion.li
              key={a.id}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.45, delay: 0.2 + i * 0.07, ease: [0.16, 1, 0.3, 1] }}
              className="rounded-[14px] bg-surface shadow-[0_2px_0_var(--edge)]"
            >
              <div className="flex items-center gap-3 p-3 md:p-4">
                <motion.span
                  className="grid size-9 shrink-0 place-items-center rounded-full"
                  animate={{ backgroundColor: done ? "var(--good)" : "var(--surface-2)", color: done ? "var(--surface)" : "var(--text)" }}
                >
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span key={String(done)} initial={{ scale: 0.3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.3, opacity: 0 }}>
                      {done ? <Check size={18} weight="bold" aria-hidden /> : <Ico size={18} aria-hidden />}
                    </motion.span>
                  </AnimatePresence>
                </motion.span>
                <button type="button" onClick={() => setOpen(expanded ? null : a.id)} aria-expanded={expanded} className="min-w-0 flex-1 text-left">
                  <span className="block truncate font-semibold">{a.title}</span>
                  <span className="block truncate text-xs text-muted">To {a.to}</span>
                </button>
                {sendUrl(a) && !done ? (
                  <a
                    href={sendUrl(a)!}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => mark(a.id)}
                    className="typed shrink-0 rounded border-2 border-text bg-accent px-3 py-1 text-xs font-bold text-on-accent transition active:scale-[0.97]"
                  >
                    Send
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={() => mark(a.id)}
                    disabled={done}
                    className="typed shrink-0 rounded border-2 border-text px-3 py-1 text-xs font-bold transition active:scale-[0.97] disabled:border-good disabled:text-good"
                  >
                    {done ? (sendUrl(a) ? "Sent" : "Booked") : "Booked it"}
                  </button>
                )}
              </div>
              <AnimatePresence initial={false}>
                {expanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="border-t-2 border-dashed border-line p-4">
                      <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-text/90">{a.body}</pre>
                      <button
                        type="button"
                        onClick={async () => {
                          await navigator.clipboard?.writeText(a.body).catch(() => {});
                          setCopied(a.id);
                          setTimeout(() => setCopied(null), 1600);
                        }}
                        className="mt-3 inline-flex items-center gap-1.5 rounded-[10px] border-2 border-line px-3 py-1.5 text-xs font-semibold transition active:scale-[0.97]"
                      >
                        {copied === a.id ? <Check size={14} aria-hidden /> : <CopySimple size={14} aria-hidden />}
                        {copied === a.id ? "Copied" : "Copy text"}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs text-muted">Send opens WhatsApp or your email app with the message filled in. Nothing goes out until you press send there.</p>
    </div>
  );
}
