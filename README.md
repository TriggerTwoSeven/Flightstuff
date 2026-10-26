# ReadyRoute

Pre-flight checker for UK-to-Europe shipments. Describe a shipment in plain English, or upload a booking sheet. ReadyRoute runs ten customs and carrier rules, explains each problem, fixes most of them in one tap, picks a carrier and drafts the commercial invoice.

## Try it

- **Describe a shipment.** Type it like a message. The desk fills the booking sheet, then asks for whatever is missing one question at a time, with quick-reply chips. Say "make it fastest" or "add a pallet" and everything recalculates.
- **Upload a booking sheet.** An `.xlsx` with `Bookings` and `Items` sheets. Every booking gets all ten checks. Filter by status, export results as CSV, open any booking for detail. No file? "Run the practice file" loads one with a planted problem per rule.
- **History** keeps saved bookings in the browser. **Rulebook** is generated from the same metadata the engine uses, so the thresholds you read are the thresholds applied.

## The ten rules

| Rule | Check | Level |
|------|-------|-------|
| R-01 | Every line has an HS code of at least 6 digits (dots and spaces ignored) | Red |
| R-02 | Declared value within 1% of quantity x unit price | Red |
| R-03 | Units per carton x cartons = quantity | Red |
| R-04 | Booking cartons = sum of item cartons | Red |
| R-05 | Weight per pallet within the carrier limit | Red |
| R-06 | Prohibited goods (lithium, aerosols, flammables) | Red / Amber |
| R-07 | Gross weight not below the sum of item weights | Amber |
| R-08 | Warehouse deliveries need an appointment | Amber |
| R-09 | Country of origin present | Amber |
| R-10 | Ship date not in the past (London time) | Amber |

Carriers come from a fixed 9-row rate card (3 carriers x Germany, France, Netherlands) ranked by Cheapest, Fastest, Most reliable or Balanced.

## Bugs fixed from the original build

- HS codes typed with dots (`6912.00`) or stored as spreadsheet numbers were rejected or mangled.
- R-05 reported a nonsense "carrier" when no carrier was chosen yet, and suggested spreading pallets that still broke the limit.
- Prohibited-goods matching hit harmless words ("battery-free", "perfume bottle holder") and missed plurals.
- "1,080" in a message was read as 1 and then 0. Item lists, "a/an" and trailing place names were mis-parsed.
- Carrier ranking normalisation was inverted for "higher is better" measures, and Balanced scored with the wrong weights.
- R-08 only understood the exact word "Yes"; R-10 used the visitor's time zone instead of London.
- Excel date cells shifted by a day in some time zones.
- Starting a sample shipment kept products from the previous chat.
- Opening a deep link (`#/upload`) after a reload showed the home page; the Back button left the app.
- Duplicate booking IDs in a file could not be opened separately.
- The app crashed on load when no database or AI key was configured. Both are now optional.
- Build failed under Next.js 16 prerender because of a random ID created during render.

## Run it

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # 70 tests: rules, carriers, parser, conversation, Excel upload
npm run build
```

## Environment (all optional)

See `.env.example`. `GEMINI_API_KEYS` adds a model-backed reader on top of the built-in one (its output is validated before use; if it is missing or fails, the built-in reader answers). `DATABASE_URL` enables `/api/bookings` after running `schema.sql`.

## Stack

Next.js 16 (App Router), React 19, TypeScript, Tailwind v4, decimal.js, zod, SheetJS (client-side parsing only), vitest. Archivo variable font, self-hosted.
