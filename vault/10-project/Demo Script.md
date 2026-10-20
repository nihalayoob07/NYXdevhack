---
type: note
tags: [project, pitch]
created: 2026-10-20
updated: 2026-10-20
summary: The 90-second walkthrough for judges.
---
# Demo Script (about 2 minutes)

Open https://nyxdevhack.vercel.app on a fresh browser (or "New trip").

1. **Add a trip (30s).** Paste two or three booking confirmations (flight, train, event) and press "Read my bookings". The AI turns them into bookings; show you can fix any field. Add your limits in plain words. "Watch my trip": your bookings appear as a ticket stack.
2. **Something went wrong (15s).** Pick the flight → Delayed → 3h → "Check my trip". The flight gets +3H LATE, the train MISSED, the event AT RISK, with the exact reason for each.
3. **Find a way through (30s).** Travv shows the gap: KSR Bengaluru → Mysuru, after 23:00, before Tue 08:30, plus real searches (IRCTC, Google Maps drive time, Uber, redBus). Open Google Maps to show the drive time, then "I found one" on Cab, enter the time and price, "Check it".
4. **Checked (15s).** The engine checks it against the whole chain and your limits. "Compare with AI" for the explanation. Add a second option to show ranking and "ruled out".
5. **Go with this (15s).** NEW / KEPT tickets, arrival, cost, spare time. "Save as my trip": Travv now watches the new chain.
6. **Ready to send (10s).** Send opens WhatsApp for family and email for the refund. The DGCA claim appears when a flight is cancelled.
7. **Example trip (optional).** "Try an example trip" → "Inbound flight delayed 2h": the airline still says ON TIME, Travv warned 41 min earlier. Then Stranded mode, reply "1".

Judge question to expect: "What if the AI hallucinates?" Answer: the AI only reads your bookings (you check them) and explains. Every time and rupee is either typed by you or computed by the engine, and Travv never invents a flight or train. See [[Architecture]].
