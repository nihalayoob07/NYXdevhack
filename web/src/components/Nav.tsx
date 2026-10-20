import Link from "next/link";
import { trip } from "@/lib/world";

// Two dominoes, the first one falling.
export function Logo() {
  return (
    <svg width="22" height="20" viewBox="0 0 22 20" aria-hidden="true">
      <rect x="2" y="2" width="8" height="18" rx="2" fill="currentColor" opacity=".45" transform="rotate(-18 2 20)" />
      <rect x="11" y="2" width="8" height="18" rx="2" fill="currentColor" />
    </svg>
  );
}

const initials = trip.traveller
  .split(" ")
  .map((w) => w[0])
  .join("");

export function Nav() {
  return (
    <header className="sticky top-0 z-30 border-b-2 border-dashed border-line bg-bg/85 backdrop-blur-md">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-8" aria-label="Main">
        <Link href="/" className="serif flex items-center gap-2 text-xl font-bold">
          <Logo />
          Domino
        </Link>
        <div className="flex items-center gap-1 text-sm">
          <Link href="/" className="rounded-full px-3 py-2 font-semibold text-muted transition-colors hover:text-text">
            My trip
          </Link>
          <Link href="/stranded" className="rounded-full px-3 py-2 font-semibold text-muted transition-colors hover:text-text">
            Stranded mode
          </Link>
          <span className="ml-2 grid size-[34px] place-items-center rounded-full bg-text text-xs font-bold text-bg" aria-label={trip.traveller}>
            {initials}
          </span>
        </div>
      </nav>
    </header>
  );
}
