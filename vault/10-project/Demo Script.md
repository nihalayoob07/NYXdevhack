---
type: note
tags: [project, pitch]
created: 2026-10-20
updated: 2026-10-20
summary: The 90-second walkthrough for judges.
---
# Demo Script (about 90 seconds)

Open https://nyxdevhack.vercel.app. It is the product itself: Ananya's trip.

1. **Your bookings (10s).** Four tickets: flight → train → hotel → wedding. "Domino watches every booking. Each one depends on the one before."
2. **Send a disruption → Inbound flight delayed 2h.** A notification drops in. The flight gets a +2H LATE stamp, the train MISSED, hotel and muhurtham AT RISK.
3. **Alert.** "Detected 10:50, 41 min before IndiGo. The aircraft is still in Bengaluru." The IndiGo app still says ON TIME; wait for it to flip to DELAYED 2H: "Domino warned you 41 minutes earlier."
4. **Agent log.** Each step streams in. Point at the limits it read from plain words (right panel): deadline, budget, no overnight buses, comfort for mum.
5. **Here's how to fix it.** A is Best. Read B's trade-off. Open "ruled out" to show the overnight bus and the Hyderabad route rejected by code.
6. **Approve and book.** "You're back on track": new tickets print in with NEW / KEPT stamps, plus arrival, cost and spare time.
7. **Ready to send.** Approve all. Then Reset → **Flight cancelled** to show the DGCA compensation claim and the money back.
8. **Stranded mode (10s).** Reply "1". "Works on 8% battery."

Judge question to expect: "What if the AI hallucinates?" Answer: the engine checks every time and rupee; the AI only explains, and the numbers override it. See [[Architecture]].
