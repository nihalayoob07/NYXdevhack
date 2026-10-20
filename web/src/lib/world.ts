import tripJson from "@/data/trip.json";
import scenariosJson from "@/data/scenarios.json";
import type { Scenario, Trip } from "./engine";

export const trip = tripJson as Trip;
export const scenarios = scenariosJson as Scenario[];
export const getScenario = (id: string) => scenarios.find((s) => s.id === id);
