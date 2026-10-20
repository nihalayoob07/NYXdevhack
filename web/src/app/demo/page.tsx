import type { Metadata } from "next";
import { DemoConsole } from "@/components/demo/DemoConsole";

export const metadata: Metadata = { title: "Live demo | Domino" };

export default function DemoPage() {
  return <DemoConsole />;
}
