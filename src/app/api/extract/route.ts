import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const maxDuration = 20;

const SYSTEM_PROMPT = `You read messages from people booking UK-to-Europe pallet shipments and pull out facts. Return ONLY JSON, no markdown.

Return only what THIS message states or changes. Use null or leave a field out when the message does not say. Never guess.

Shape:
{
  "booking": {
    "sellerName": string,
    "originCity": one of London, Manchester, Birmingham, Leeds,
    "destinationCity": one of Berlin, Frankfurt, Hamburg, Paris, Lyon, Amsterdam, Rotterdam,
    "destinationCountry": one of Germany, France, Netherlands,
    "destinationType": "Warehouse" or "Business address",
    "readyToShipDate": "DD-MM-YYYY" (resolve words like "tomorrow" or "next Monday" using today's date given below),
    "sellerPriority": "Cheapest", "Fastest", "Most reliable" or "Balanced",
    "pallets": number, "cartons": number,
    "totalDeclaredValue": number in GBP, "totalGrossWeight": number in kg for the whole shipment,
    "deliveryAppointmentBooked": "Yes" or "No"
  },
  "items": [ products NAMED in this message: { "description", "quantity", "unitPrice", "hsCode", "unitsPerCarton", "cartons", "unitWeight" (kg per unit), "countryOfOrigin" (where it was made) } ],
  "itemPatch": { the same item fields, when the message gives product details without naming a product },
  "palletsDelta": integer, only for relative changes like "add a pallet" (1) or "one fewer pallet" (-1),
  "unsupported": [ short notes about anything asked that is outside UK origin and Germany, France or the Netherlands ]
}`;

const COOL_DOWN_MS = 60_000;
const cooling = new Map<string, number>();

function readKeys(): string[] {
  const raw = `${process.env.GEMINI_API_KEYS ?? ''},${process.env.GEMINI_API_KEY ?? ''}`;
  return [...new Set(raw.split(/[\s,;]+/).map(k => k.trim()).filter(Boolean))];
}

const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T> =>
  Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

/**
 * Optional AI reading of a message. With no key set, or if every key fails,
 * it answers { ok: false } and the browser falls back to the built-in parser,
 * so the desk always works. Several keys can be set (GEMINI_API_KEYS); a key
 * that is rate-limited or rejected is rested for a minute and the next is used.
 */
export async function POST(req: NextRequest) {
  const keys = readKeys();
  if (keys.length === 0) return NextResponse.json({ ok: false, reason: 'no-key' });

  let body: { message?: unknown; context?: unknown; today?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: 'bad-request' }, { status: 400 });
  }
  const message = typeof body.message === 'string' ? body.message.slice(0, 4000) : '';
  if (!message.trim()) return NextResponse.json({ ok: false, reason: 'empty' }, { status: 400 });
  const today = typeof body.today === 'string' ? body.today.slice(0, 40) : new Date().toISOString().slice(0, 10);

  const prompt = `${SYSTEM_PROMPT}\n\nToday is ${today}.\nWhat is already known (do not repeat it unless the message changes it): ${JSON.stringify(body.context ?? {}).slice(0, 3000)}\n\nMessage: """${message}"""`;
  const now = Date.now();
  const ready = keys.filter(k => (cooling.get(k) ?? 0) <= now);
  const order = ready.length > 0 ? ready : keys;

  for (const key of order) {
    try {
      const model = new GoogleGenerativeAI(key).getGenerativeModel({
        model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
        generationConfig: { temperature: 0, maxOutputTokens: 1024, responseMimeType: 'application/json' },
      });
      const result = await withTimeout(model.generateContent(prompt), 12_000);
      const text = result.response.text().replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
      return NextResponse.json({ ok: true, data: JSON.parse(text) });
    } catch (err) {
      cooling.set(key, Date.now() + COOL_DOWN_MS);
      console.error('Gemini extraction failed for one key:', err instanceof Error ? err.message : 'unknown error');
    }
  }
  return NextResponse.json({ ok: false, reason: 'unavailable' });
}
