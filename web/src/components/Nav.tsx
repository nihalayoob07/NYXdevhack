import Link from "next/link";

export function Logo() {
  // Two dominoes, the second one tipping.
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
      <rect x="2" y="3" width="7" height="16" rx="2" fill="currentColor" />
      <rect x="12" y="3" width="7" height="16" rx="2" fill="var(--accent)" transform="rotate(14 19 19)" />
    </svg>
  );
}

export function Nav() {
  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-bg/80 backdrop-blur-md">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-8" aria-label="Main">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <Logo />
          Domino
        </Link>
        <div className="flex items-center gap-1 text-sm">
          <Link
            href="/"
            className="rounded-full bg-accent px-4 py-2 font-medium text-on-accent transition-transform active:scale-[0.97]"
          >
            Open the app
          </Link>
        </div>
      </nav>
    </header>
  );
}
