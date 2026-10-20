import Link from "next/link";
import { Avatar } from "@/components/app/Avatar";

// Two dominoes, the first one falling.
export function Logo() {
  return (
    <svg width="22" height="20" viewBox="0 0 22 20" aria-hidden="true">
      <rect x="2" y="2" width="8" height="18" rx="2" fill="currentColor" opacity=".45" transform="rotate(-18 2 20)" />
      <rect x="11" y="2" width="8" height="18" rx="2" fill="currentColor" />
    </svg>
  );
}

export function Nav() {
  return (
    <header className="sticky top-0 z-30 border-b-2 border-dashed border-line bg-bg/85 backdrop-blur-md">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-8" aria-label="Main">
        <Link href="/" className="serif flex items-center gap-2 text-xl font-bold">
          <Logo />
          Travv
        </Link>
        <div className="flex items-center gap-1 whitespace-nowrap text-sm">
          <Link href="/" className="hidden rounded-full px-3 py-2 font-semibold text-muted transition-colors hover:text-text sm:block">
            My trip
          </Link>
          <Link href="/stranded" className="rounded-full px-2 py-2 font-semibold text-muted transition-colors hover:text-text sm:px-3">
            Stranded<span className="hidden sm:inline"> mode</span>
          </Link>
          <Avatar />
        </div>
      </nav>
    </header>
  );
}
