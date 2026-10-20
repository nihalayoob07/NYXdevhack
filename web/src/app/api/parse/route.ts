import { z } from "zod";
import type { Draft } from "@/lib/recover";

export const maxDuration = 30;

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";

const PROMPT = `You read travel booking confirmations (emails, SMS, e-tickets) and list the bookings.
Reply with JSON only: {"traveller": string|null, "passengers": number|null, "bookings": [{
  "mode": "flight"|"train"|"bus"|"cab"|"hotel"|"event",
  "title": short name, e.g. "IndiGo 6E 2417", "Mysuru Intercity 16557", "The Chamundi Courtyard", "Kavya's wedding",
  "from": departure place, flights as "City CODE" e.g. "Delhi DEL",
  "to": arrival place; hotels: the city; events: "venue, city",
  "depart": "YYYY-MM-DDTHH:MM" local time; events: when it starts,
  "arrive": "YYYY-MM-DDTHH:MM" local time,
  "check_in": hotels only, "YYYY-MM-DD",
  "check_in_by": hotels only, latest check-in "YYYY-MM-DDTHH:MM" if stated,
  "price_inr": total paid for everyone, number,
  "ref": PNR or booking reference
}]}
Use only facts in the text. Leave a field out when the text doesn't say it. Never guess a time or a year;
if the year is missing, use the next date on or after today (TODAY).`;

const Out = z.object({
  traveller: z.string().nullish(),
  passengers: z.number().int().min(1).max(20).nullish(),
  bookings: z
    .array(
      z.object({
        mode: z.enum(["flight", "train", "bus", "cab", "hotel", "event"]),
        title: z.string(),
        from: z.string().nullish(),
        to: z.string().nullish(),
        depart: z.string().nullish(),
        arrive: z.string().nullish(),
        check_in: z.string().nullish(),
        check_in_by: z.string().nullish(),
        price_inr: z.number().nullish(),
        ref: z.string().nullish(),
      }),
    )
    .max(12),
});

// Pasted confirmations -> draft bookings. The traveller checks and edits them before anything is saved.
export async function POST(req: Request) {
  const { text, today } = await req.json().catch(() => ({}));
  if (typeof text !== "string" || text.trim().length < 20) return Response.json({ error: "Paste at least one booking confirmation" }, { status: 400 });
  if (!process.env.GROQ_API_KEY) return Response.json({ error: "Reading bookings needs the AI (GROQ_API_KEY is not set). Add them by hand below." }, { status: 503 });

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0,
      reasoning_effort: "low",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: PROMPT.replace("TODAY", typeof today === "string" ? today.slice(0, 10) : new Date().toISOString().slice(0, 10)) },
        { role: "user", content: text.slice(0, 8000) },
      ],
    }),
    signal: AbortSignal.timeout(25_000),
  }).catch(() => null);
  if (!res?.ok) return Response.json({ error: res?.status === 429 ? "The free AI tier is busy. Try again in a minute, or add bookings by hand." : "Couldn't read that. Add the bookings by hand below." }, { status: 502 });

  const parsed = Out.safeParse(JSON.parse((await res.json()).choices?.[0]?.message?.content ?? "null"));
  if (!parsed.success || !parsed.data.bookings.length) return Response.json({ error: "No bookings found in that text. Add them by hand below." }, { status: 422 });
  const bookings: Draft[] = parsed.data.bookings.map((b, i) => ({
    id: `p${i}-${Date.now().toString(36)}`, // the form keeps these as keys
    mode: b.mode,
    title: b.title,
    from: b.from ?? undefined,
    to: b.to ?? undefined,
    depart: b.depart?.slice(0, 16) ?? undefined,
    arrive: b.arrive?.slice(0, 16) ?? undefined,
    checkIn: b.check_in?.slice(0, 10) ?? b.depart?.slice(0, 10) ?? undefined,
    checkInBy: b.check_in_by?.slice(0, 16) ?? undefined,
    price: b.price_inr ?? undefined,
    ref: b.ref ?? undefined,
  }));
  return Response.json({ traveller: parsed.data.traveller ?? null, passengers: parsed.data.passengers ?? null, bookings });
}
