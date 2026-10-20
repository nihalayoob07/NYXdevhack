---
type: note
tags: [project, pitch, architecture]
created: 2026-10-20
updated: 2026-10-20
summary: The technical approach in slide-ready form, for the shortlist PPT.
---
# Tech Approach (for the PPT)

**One line:** a trip is a chain of linked bookings. Travv models that chain, finds every booking one disruption breaks, and repairs it with options that a deterministic engine checks. The AI reads and explains, but never decides.

## 1. Trip as a dependency chain
- Each booking (flight, train, bus, cab, hotel, event) is a node with times, a place and the connection buffer it needs from the one before.
- One delay is propagated down the chain: delayed → missed → at risk, with the exact reason ("Leaves 20:30, you can't get there before 23:00").

## 2. AI where it helps, code where it must be right
| Job | Done by |
|---|---|
| Read pasted booking emails/SMS into structured bookings | LLM (Groq, `gpt-oss-120b`, JSON mode, validated with zod, user confirms every field) |
| Turn "must reach by 9am Tue, max ₹4,000, no overnight bus, travelling with mum" into hard + soft limits | LLM tool call, with a rule-based fallback |
| Connections, arrival times, costs, layovers, feasibility, ranking | **Deterministic engine** (plain TypeScript, unit-checked) |
| Explain trade-offs in plain words | LLM, constrained to the engine's numbers |
| Refund requests, DGCA compensation claim, family message | Engine templates, sent via WhatsApp / email |

**Anti-hallucination:** the AI never invents a flight, time or price. If its verdict contradicts the engine, the engine wins.

## 3. Recovery without fake inventory
- The engine computes the gap: "KSR Bengaluru → Mysuru, leave after 23:00, arrive by Tue 08:30".
- Prefilled real searches: Google Flights, IRCTC, Google Maps drive time, Uber, redBus, Booking.com.
- Each option the traveller finds goes back into the engine, which checks it against the whole chain and their limits. Options are ranked, the ones that fail are ruled out with a reason, and the AI compares them.
- Approve → the repaired chain becomes the new trip that Travv watches.

## 4. Built for bad moments
- **Stranded mode:** a 1/2/3 text chat with CSS-only animation, so it works on 8% battery and airport Wi-Fi.
- **Offline planner:** if the AI is down or rate-limited, the same steps run with engine-written explanations, so the demo never fails.
- Free tier by design: about 2 LLM calls per recovery (~4k tokens).

## 5. Stack
Next.js 16 (React 19, TypeScript) on Vercel · Groq API (OpenAI-compatible) · zod validation · Motion for animation · trip stored on the device (no account, privacy by default).

## 6. Roadmap after the shortlist
Live flight-status API for automatic early warning (aircraft inbound-delay tracking), airline/IRCTC partner APIs for one-tap rebooking, mobile app with push notifications, and email forwarding to add trips.

Related: [[Architecture]], [[Decisions]], [[Travv Overview]]
