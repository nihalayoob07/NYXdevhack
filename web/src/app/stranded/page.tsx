import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { StrandedChat } from "@/components/StrandedChat";
import { getScenario, scenarios } from "@/lib/world";

export const metadata: Metadata = { title: "Stranded mode | Domino" };

// The scenario comes from ?s=, which is request data, so it streams in under Suspense.
async function Body({ searchParams }: { searchParams: PageProps<"/stranded">["searchParams"] }) {
  const { s } = await searchParams;
  const scenario = getScenario(typeof s === "string" ? s : "") ?? scenarios[0];
  return (
    <>
      <nav aria-label="Scenario" className="mt-6 flex flex-wrap content-start items-start gap-2 md:col-start-1">
        {scenarios.map((x) => (
          <Link
            key={x.id}
            href={`/stranded?s=${x.id}`}
            aria-current={x.id === scenario.id ? "page" : undefined}
            className={`typed rounded border-2 px-3 py-1.5 text-xs transition-colors ${x.id === scenario.id ? "border-accent bg-accent text-on-accent" : "border-line text-muted hover:text-text"}`}
          >
            {x.chaos}
          </Link>
        ))}
      </nav>
      <div className="md:col-start-2 md:row-span-2 md:row-start-1">
        <StrandedChat key={scenario.id} s={scenario} />
      </div>
    </>
  );
}

export default function StrandedPage({ searchParams }: PageProps<"/stranded">) {
  return (
    <>
      <div className="mx-auto grid max-w-5xl gap-x-8 px-4 py-8 md:grid-cols-[1fr_400px] md:content-center md:px-8 md:py-12">
        <div className="md:col-start-1 md:self-end">
          <h1 className="text-4xl font-bold md:text-5xl">Stranded mode</h1>
          <p className="mt-3 max-w-[48ch] leading-relaxed text-muted">
            8% battery and airport Wi-Fi. One message, the best options, reply with a number. Same engine as the app, no dashboard to load.
          </p>
        </div>
        <Suspense fallback={<div className="mt-6 h-[560px] animate-pulse rounded-3xl bg-surface-2 md:col-start-2 md:row-span-2 md:row-start-1 md:mt-0" />}>
          <Body searchParams={searchParams} />
        </Suspense>
      </div>
    </>
  );
}
