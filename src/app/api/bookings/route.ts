import { NextRequest, NextResponse } from 'next/server';
import { saveBookingReport, getBookingHistory } from '@/lib/db';

export async function GET() {
  try {
    const rows = await getBookingHistory();
    return NextResponse.json(rows);
  } catch (err) {
    console.error('Failed to fetch bookings:', err);
    return NextResponse.json({ error: 'Failed to fetch bookings' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const report = await req.json();
    await saveBookingReport(report);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Failed to save booking:', err);
    return NextResponse.json({ error: 'Failed to save booking' }, { status: 500 });
  }
}
