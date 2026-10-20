// Self-check for the demo story. Run: npm run check
import assert from "node:assert/strict";
import trip from "../src/data/trip.json" with { type: "json" };
import scenarios from "../src/data/scenarios.json" with { type: "json" };
import { draftActions, findAffected, parseConstraints, rankPlans, type Scenario, type Trip } from "../src/lib/engine.ts";

const t = trip as Trip;
const all = scenarios as Scenario[];
const s = (id: string) => all.find((x) => x.id === id)!;
const c = parseConstraints(t.defaultConstraints);

assert.deepEqual(c, { deadline: 1980, budget: 4000, noOvernightBus: true, maxLayover: 120, companion: "mum" });

// The domino: one delay turns three more links red.
assert.deepEqual(findAffected(t, s("inbound-delay")).map((n) => n.status), ["delayed", "broken", "at-risk", "at-risk"]);
assert.deepEqual(findAffected(t, null).map((n) => n.status), ["ok", "ok", "ok", "ok"]);
assert.deepEqual(findAffected(t, s("hotel-overbooked")).map((n) => n.status), ["ok", "ok", "cancelled", "ok"]);

const expectTop: Record<string, string> = {
  "inbound-delay": "s1-earlier",
  "flight-cancelled": "s2-ai",
  "train-cancelled": "s3-cab",
  "hotel-overbooked": "s4-kaveri",
};
for (const [id, top] of Object.entries(expectTop)) {
  const ranked = rankPlans(t, s(id), c);
  console.log(id, ranked.map((r) => `${r.plan.id}(${r.score}${r.hardFails.length ? " X" : ""})`).join("  "));
  assert.equal(ranked[0].plan.id, top, `${id}: top plan`);
  assert.equal(ranked[0].hardFails.length, 0);
}

const s1 = rankPlans(t, s("inbound-delay"), c);
assert.ok(s1.find((r) => r.plan.id === "s1-bus")!.hardFails.includes("Uses an overnight bus"));
assert.ok(s1.find((r) => r.plan.id === "s1-hyd")!.hardFails.length === 2);
assert.ok(s1.find((r) => r.plan.id === "s1-overnight")!.risky);

const claim = draftActions(t, s("flight-cancelled"), rankPlans(t, s("flight-cancelled"), c)[0]);
assert.ok(claim.some((a) => a.kind === "claim"));
console.log("engine ok");
