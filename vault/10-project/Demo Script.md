---
type: note
tags: [project, pitch]
created: 2026-10-20
updated: 2026-10-20
summary: The 90-second walkthrough for judges.
---
# Demo Script (about 90 seconds)

1. **Landing page (10s).** "One delay shouldn't break your whole trip." Let the hero chain loop once: planned, broken, repaired.
2. **Run the demo.** Show Ananya's trip: flight, train, hotel, wedding. "Each link depends on the one before."
3. **Chaos panel: Inbound flight delayed 2h.** Watch the flight go orange and the next three dominoes tip over red.
4. **Point at the alert.** "The aircraft is still in Bengaluru, 118 minutes late. The airline app still says ON TIME." Wait for it to flip to DELAYED: "Domino warned you 41 minutes earlier."
5. **Agent log.** Each tool call streams in. Read the limits it extracted: deadline, budget, no overnight buses, short waits for mum.
6. **Recovery options.** Option A recommended. Read B's trade-off aloud. Open "ruled out" to show the overnight bus and the Hyderabad route rejected by code.
7. **Approve.** The repaired chain slides in green with the cost and time difference.
8. **Finished actions.** Approve all. Then switch to **Flight cancelled** to show the DGCA compensation claim.
9. **Stranded mode (10s).** Reply "1". "Works on 8% battery."

Judge question to expect: "What if the AI hallucinates?" Answer: the engine checks every time and rupee; the AI only explains, and the numbers override it. See [[Architecture]].
