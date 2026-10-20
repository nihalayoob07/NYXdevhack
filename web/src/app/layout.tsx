import type { Metadata, Viewport } from "next";
import { Fraunces, Inter_Tight, Space_Mono } from "next/font/google";
import { Nav } from "@/components/Nav";
import { Providers } from "@/components/Providers";
import "./globals.css";

// Ticket stack look: serif headings, typewriter tickets, Inter Tight body.
const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"], weight: ["500", "700"] });
const spaceMono = Space_Mono({ variable: "--font-space-mono", subsets: ["latin"], weight: ["400", "700"] });
const interTight = Inter_Tight({ variable: "--font-inter-tight", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Travv: travel disruption recovery",
  description: "One delay shouldn't break your whole trip. An AI agent that detects disruptions early and repairs every linked booking.",
};

export const viewport: Viewport = {
  themeColor: "#d8cfbd",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${fraunces.variable} ${spaceMono.variable} ${interTight.variable} antialiased`}>
      <body className="min-h-[100dvh] flex flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-accent focus:px-4 focus:py-2 focus:text-on-accent"
        >
          Skip to content
        </a>
        <Providers>
          <Nav />
          <main id="main" className="flex-1">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
