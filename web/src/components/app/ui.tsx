// Small shared pieces of the ticket stack look.

export const Eyebrow = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <p className={`typed text-[11px] uppercase tracking-[0.14em] text-muted ${className}`}>{children}</p>
);

export function Panel({ title, children, aside, className = "" }: { title: string; children: React.ReactNode; aside?: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-[22px] bg-bg p-3 shadow-[0_2px_0_#c9bfa9,0_30px_50px_-40px_rgb(60_40_20/0.55)] sm:p-4 md:p-6 ${className}`}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h2 className="text-xl font-bold">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function Status({ bad, children }: { bad?: boolean; children: React.ReactNode }) {
  return (
    <span className="typed inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-surface px-3 py-1.5 text-xs font-semibold" style={{ color: bad ? "var(--bad)" : "var(--good)" }}>
      <span className="pulse" />
      {children}
    </span>
  );
}

export const input =
  "w-full min-w-0 rounded-[10px] border-2 border-line bg-surface px-3 py-2 text-sm text-text placeholder:text-muted/70 focus:border-text focus:outline-none";

export function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="typed mb-1 block text-[11px] uppercase tracking-[0.1em] text-muted">{label}</span>
      {children}
    </label>
  );
}

export function Button({ children, onClick, disabled, kind = "solid", type = "button", className = "" }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; kind?: "solid" | "line" | "quiet"; type?: "button" | "submit"; className?: string }) {
  const look =
    kind === "solid" ? "bg-accent text-on-accent px-5 py-3 font-bold" : kind === "line" ? "border-2 border-text px-4 py-2 font-semibold" : "px-2 py-1 font-semibold text-muted underline-offset-4 hover:underline";
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`inline-flex items-center justify-center gap-2 rounded-[14px] text-sm transition active:scale-[0.98] disabled:opacity-40 ${look} ${className}`}>
      {children}
    </button>
  );
}
