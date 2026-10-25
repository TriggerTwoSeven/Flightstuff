# Preflight Desk

Conversational shipment booking and pre-flight error checker for UK-to-Europe exports.

## What it does

Two journeys:

1. **Describe a shipment** - Type what you're shipping in plain language. The app extracts details, runs 10 pre-flight validation rules, recommends a carrier, and drafts a commercial invoice.
2. **Upload bookings** - Drop an Excel file with Bookings and Items sheets. Every booking is validated against all 10 rules with a batch summary and per-booking detail views.

## 10 Pre-flight Rules

| Rule | Check | Severity |
|------|-------|----------|
| R-01 | HS code >= 6 digits | Red |
| R-02 | Declared value within 1% of calculated | Red |
| R-03 | Units per carton x cartons = quantity | Red |
| R-04 | Booking cartons = sum of item cartons | Red |
| R-05 | Weight per pallet <= carrier max | Red |
| R-06 | Prohibited goods (lithium, aerosol, flammable) | Red / Amber |
| R-07 | Gross weight >= sum of item weights | Amber |
| R-08 | Warehouse needs delivery appointment | Amber |
| R-09 | Country of origin present | Amber |
| R-10 | Ship date not in the past (UK timezone) | Amber |

## Carrier Recommendation

9-row fixed rate card covering 3 carriers x 3 destination countries (Germany, France, Netherlands). Four priority modes:
- **Cheapest** - lowest cost, tie-break: highest reliability
- **Fastest** - shortest transit, tie-break: lowest cost
- **Most reliable** - highest on-time %, tie-break: lowest cost
- **Balanced** - weighted score: 0.40 x costN + 0.30 x transitN + 0.30 x (1 - relN)

## Tech Stack

- Next.js 16 (App Router) + TypeScript + Tailwind CSS
- SheetJS (xlsx) for Excel parsing
- decimal.js for precise money/weight arithmetic
- Zod for schema validation
- Vitest for unit tests

## Running locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Tests

```bash
npm test
```

40 tests covering all 10 rules and the carrier recommendation engine.

## Design Decisions

- **Deterministic engine**: The LLM (if configured) only extracts text. All arithmetic, pass/fail decisions, and carrier ranking use decimal.js and pure functions. No AI does math.
- **No database, no login**: Session-scoped state only. This is an MVP for a hackathon.
- **Fallback parser**: Works without an LLM API key using regex-based extraction.
- **Fixed rate card**: Real carrier APIs are out of scope. The 9-row test rate card is the single source of truth.
- **UK origin only**: Fixed operating boundary - 4 UK origin cities, 3 EU destination countries, GBP currency.

## Known Limitations

- LLM integration requires an API key in env vars (falls back to regex parser without one)
- No persistence - refreshing the page resets all state
- Sample workbook download triggers a browser-side file generation, not a server download
- The carrier rate card is fixed test data, not live rates
- Invoice draft shows placeholder fields that can't be filled in the MVP
