---
type: note
tags: [project, pitch]
created: 2026-10-20
updated: 2026-10-20
summary: Problem statement, the Domino idea and what the MVP covers.
---
# Domino Overview

## Problem statement
AI agent for travel disruption recovery. Flight, train and hotel delays or cancellations leave travellers without a clear way to manage affected bookings. Build an agent that detects disruptions, identifies affected bookings, evaluates alternatives and generates a recovery itinerary within the traveller's constraints.

## Our angle
Most teams will build "flight cancelled, chatbot suggests another flight". We attack what hurts most:

1. **The domino problem (core).** A trip is a chain of linked bookings. When one link breaks, show the ripple and repair the whole chain together.
2. **Know before the airline tells you (wow moment).** Watch the inbound aircraft, weather and strikes. Have Plan B ready before the announcement.
3. **Constraints in plain language (core).** "Must reach Mysuru by 9am Tuesday, max ₹4,000 extra, no overnight buses, travelling with my mum." Becomes hard limits and soft preferences.
4. **Recovery includes money back (core).** Draft DGCA compensation claims, refunds, hotel and family messages, ready to approve.
5. **Stranded mode.** 8% battery: one message, three options, reply 1, 2 or 3.

## The demo trip (simulated)
Ananya Rao and her mother, Delhi to Mysuru for a cousin's wedding muhurtham at 09:00 Tuesday.
IndiGo 6E 2417 DEL→BLR, then Mysuru Intercity, then The Chamundi Courtyard, then the wedding.
Data: `web/src/data/trip.json` and `web/src/data/scenarios.json`. See [[Architecture]].

## Out of scope for the MVP
Real airline and IRCTC APIs, payments, multi-traveller groups. Add only if we pass the shortlist.

Related: [[Demo Script]], [[Decisions]]
