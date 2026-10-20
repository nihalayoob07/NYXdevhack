import Link from "next/link";
import { ConstraintParse, HeroChain, Reveal, RippleStatement, SignalFeed } from "@/components/landing/Islands";
import { rupees } from "@/lib/engine";
import { trip } from "@/lib/world";

const flight = trip.bookings[0];

export default function Home() {
  return (
    <>
      <section className="mx-auto max-w-7xl px-4 pb-16 pt-12 md:px-8 md:pt-20">
        <Reveal>
          <h1 className="max-w-[16ch] text-5xl font-semibold leading-[1.02] tracking-tighter md:text-7xl">
            One delay shouldn&apos;t break your whole trip.
          </h1>
        </Reveal>
        <Reveal delay={0.1} className="mt-6 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <p className="max-w-[46ch] text-lg leading-relaxed text-muted">
            Domino spots disruptions before the airline announces them, then repairs every booking that depends on the broken one.
          </p>
          <div className="flex shrink-0 gap-3">
            <Link href="/demo" className="rounded-full bg-accent px-6 py-3 font-medium text-on-accent transition active:scale-[0.97]">
              Run the demo
            </Link>
            <Link href="/stranded" className="rounded-full border border-line px-6 py-3 font-medium transition hover:border-muted active:scale-[0.97]">
              Stranded mode
            </Link>
          </div>
        </Reveal>
        <Reveal delay={0.2} className="mt-12">
          <HeroChain />
        </Reveal>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-24 md:px-8 md:py-36">
        <RippleStatement />
      </section>

      <section className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-20 md:grid-cols-2 md:px-8">
        <Reveal>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-accent-ink">Early warning</p>
          <h2 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">Know before the airline tells you</h2>
          <p className="mt-4 max-w-[44ch] leading-relaxed text-muted">
            Your plane is usually still flying its previous leg. Domino watches that aircraft, the weather and strike notices, and has Plan B ready first.
          </p>
        </Reveal>
        <Reveal delay={0.1}>
          <SignalFeed />
        </Reveal>
      </section>

      <section className="px-4 py-24 md:px-8">
        <Reveal className="mx-auto mb-10 max-w-2xl text-center">
          <h2 className="text-4xl font-semibold tracking-tight md:text-5xl">Your limits, in your words</h2>
          <p className="mt-4 leading-relaxed text-muted">Type it the way you would say it. Domino turns it into hard limits it never breaks and preferences it weighs.</p>
        </Reveal>
        <ConstraintParse />
      </section>

      <section className="mx-auto max-w-7xl px-4 py-24 md:px-8">
        <Reveal>
          <h2 className="max-w-[18ch] text-4xl font-semibold tracking-tight md:text-5xl">Recovery includes getting your money back</h2>
        </Reveal>
        <div className="mt-10 grid gap-3 md:grid-cols-3 md:grid-rows-2">
          <Reveal className="rounded-3xl border border-line bg-surface p-6 md:col-span-2 md:row-span-2">
            <p className="text-sm font-medium">DGCA compensation claim</p>
            <p className="mt-1 text-sm text-muted">Drafted the moment a cancellation qualifies.</p>
            <div className="mt-5 rounded-2xl bg-surface-2 p-5 text-sm leading-relaxed">
              <p className="text-muted">To IndiGo customer care, cc AirSewa</p>
              <p className="mt-3">
                Flight {flight.title} was cancelled on the day of travel and the alternate offered departs more than two hours later. Under DGCA CAR Section 3, Series M,
                Part IV, I request a full refund of {rupees(flight.price!)} and compensation of ₹10,000 per passenger.
              </p>
            </div>
          </Reveal>
          <Reveal delay={0.08} className="rounded-3xl bg-accent p-6 text-on-accent">
            <p className="font-mono text-4xl font-semibold tabular">{rupees(flight.price!)}</p>
            <p className="mt-2 text-sm">full refund, plus up to ₹20,000 compensation for two, in the cancelled-flight scenario</p>
          </Reveal>
          <Reveal delay={0.16} className="rounded-3xl border border-good/40 bg-[color-mix(in_oklab,var(--good)_10%,var(--surface))] p-6">
            <p className="text-sm font-medium">To Meera, on WhatsApp</p>
            <p className="mt-3 text-sm leading-relaxed">Small change of plan. Amma and I now reach Mysuru around 23:05. All fine for the muhurtham tomorrow.</p>
          </Reveal>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-20 md:grid-cols-2 md:px-8">
        <Reveal className="order-2 md:order-1">
          <div className="mx-auto max-w-sm space-y-2 rounded-3xl border border-line bg-surface p-4">
            <p className="max-w-[85%] rounded-2xl rounded-bl-md bg-surface-2 px-3.5 py-2.5 text-sm">Your flight will leave about 2 hours late. This breaks your train and hotel.</p>
            <p className="max-w-[85%] whitespace-pre-line rounded-2xl rounded-bl-md bg-surface-2 px-3.5 py-2.5 font-mono text-xs leading-relaxed">
              {"1  Earlier flight, +₹2,900\n2  Cab to Mysuru, +₹3,340\n3  Airport hotel, +₹3,660"}
            </p>
            <p className="ml-auto w-fit rounded-2xl rounded-br-md bg-accent px-4 py-2.5 font-mono text-sm text-on-accent">1</p>
          </div>
        </Reveal>
        <Reveal delay={0.1} className="order-1 md:order-2">
          <h2 className="text-4xl font-semibold tracking-tight md:text-5xl">Works on 8% battery</h2>
          <p className="mt-4 max-w-[44ch] leading-relaxed text-muted">One message, three options. Reply 1, 2 or 3. No dashboard to load on airport Wi-Fi.</p>
          <Link href="/stranded" className="mt-6 inline-block rounded-full border border-line px-6 py-3 font-medium transition hover:border-muted active:scale-[0.97]">
            Stranded mode
          </Link>
        </Reveal>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-24 md:px-8">
        <Reveal>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-accent-ink">Under the hood</p>
          <h2 className="mt-3 max-w-[20ch] text-4xl font-semibold tracking-tight md:text-5xl">What if the AI makes up a train time?</h2>
        </Reveal>
        <div className="mt-10 grid gap-px overflow-hidden rounded-3xl border border-line bg-line md:grid-cols-2">
          <Reveal className="bg-surface p-6 md:p-8">
            <p className="font-medium">Plain code checks</p>
            <p className="mt-3 leading-relaxed text-muted">Every connection, arrival time, rupee and layover is computed, not generated. A plan that misses your deadline is ruled out before the AI sees it.</p>
          </Reveal>
          <Reveal delay={0.08} className="bg-surface p-6 md:p-8">
            <p className="font-medium">Claude explains</p>
            <p className="mt-3 leading-relaxed text-muted">Claude reads those results, ranks the trade-offs in plain words and drafts the messages. If it ever disagrees with the numbers, the numbers win.</p>
          </Reveal>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-24 pt-8 md:px-8">
        <Reveal className="rounded-3xl border border-line bg-surface px-6 py-14 text-center md:py-20">
          <h2 className="mx-auto max-w-[20ch] text-4xl font-semibold tracking-tight md:text-5xl">Watch one delay knock over four plans, then fix them</h2>
          <Link href="/demo" className="mt-8 inline-block rounded-full bg-accent px-7 py-3.5 font-medium text-on-accent transition active:scale-[0.97]">
            Run the demo
          </Link>
        </Reveal>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-6 text-sm text-muted md:px-8">
          <p>Domino by Team NYX, Devhack Sahyadri</p>
          <p>Simulated trip and inventory for demo purposes.</p>
        </div>
      </footer>
    </>
  );
}
