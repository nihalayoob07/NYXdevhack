import { z } from "zod";

// Trips and scenarios come from the browser, so the server checks their shape before using them.
const min = z.number().int().min(-20_160).max(40_320);
const text = z.string().max(200);

export const LegSchema = z.object({
  id: z.string().max(60),
  mode: z.enum(["flight", "train", "bus", "cab", "hotel", "event"]),
  title: text,
  from: text.optional(),
  to: text.optional(),
  dep: min.optional(),
  arr: min.optional(),
  at: min.optional(),
  checkInBy: min.optional(),
  connectMin: z.number().int().min(0).max(600).optional(),
  price: z.number().min(0).max(10_000_000).optional(),
  seatsLeft: z.number().optional(),
  overnight: z.boolean().optional(),
  distanceKm: z.number().optional(),
  changes: z.number().optional(),
  ref: text.optional(),
  note: z.string().max(400).optional(),
});

export const TripSchema = z.object({
  traveller: text,
  companion: text.optional(),
  passengers: z.number().int().min(1).max(20).optional(),
  date: text,
  week: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  waitingFor: z.object({ name: text, relation: text }).optional(),
  defaultConstraints: z.string().max(600),
  bookings: z.array(LegSchema).min(1).max(12),
});

export const ScenarioSchema = z.object({
  id: text,
  chaos: text,
  headline: text,
  detectedAt: min,
  airlineAnnouncesAt: min.optional(),
  claim: text.optional(),
  effects: z.array(z.object({ booking: text, delay: z.number().int().min(0).max(4320).optional(), cancel: z.boolean().optional() })).max(6),
  signals: z.array(z.string().max(400)).max(6),
  legs: z.array(LegSchema).max(12),
  plans: z.array(z.object({ id: text, label: text, steps: z.array(text).max(12), refunds: z.array(z.object({ booking: text, amount: z.number(), note: text })).max(12) })).min(1).max(8),
});
