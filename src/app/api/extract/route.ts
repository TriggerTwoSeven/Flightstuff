import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const SYSTEM_PROMPT = `You are a logistics data extractor. Given a natural-language shipment description, extract structured data. Return ONLY valid JSON, no markdown fences.

Extract these booking fields (use null for missing):
- sellerName, originCity, originCountry (default "United Kingdom"), destinationCity, destinationCountry
- destinationType (e.g. "warehouse", "port")
- readyToShipDate (ISO format YYYY-MM-DD)
- sellerPriority (one of: "cheapest", "fastest", "most_reliable", "balanced")
- pallets (number), cartons (number)
- totalDeclaredValue (number), currency (default "GBP")
- totalGrossWeight (number in kg)
- incoterm (e.g. "DDP", "EXW", "FOB")
- insurance, specialInstructions

Extract items array, each with:
- description, quantity (number), unitPrice (number), hsCode, countryOfOrigin
- weightPerUnit (number in kg), cartons (number), perCarton (number)

Return shape: { "booking": {...}, "items": [...] }`;

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 });
  }

  try {
    const { message, context } = await req.json();

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = context
      ? `Previous extracted data:\n${JSON.stringify(context)}\n\nUser says: "${message}"\n\nMerge the new information with the existing data. Return the complete updated JSON.`
      : `Extract shipment data from: "${message}"`;

    const result = await model.generateContent({
      contents: [
        { role: 'user', parts: [{ text: SYSTEM_PROMPT + '\n\n' + prompt }] }
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 2048,
      },
    });

    const text = result.response.text();
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);

    return NextResponse.json(parsed);
  } catch (err) {
    console.error('Gemini extraction error:', err);
    return NextResponse.json(
      { error: 'Failed to extract data', detail: String(err) },
      { status: 500 }
    );
  }
}
