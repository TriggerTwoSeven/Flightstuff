import { NextRequest, NextResponse } from 'next/server';
import { saveBookingReport, getBookingHistory, isDatabaseConfigured } from '@/lib/db';

/**
 * Optional shared history. Without DATABASE_URL the desk keeps history in the
 * visitor's own browser and these routes simply report that no database is set.
 */
export async function GET() {
  if (!isDatabaseConfigured()) return NextResponse.json({ configured: false, rows: [] });
  try {
    return NextResponse.json({ configured: true, rows: await getBookingHistory() });
  } catch (err) {
    console.error('Failed to fetch bookings:', err instanceof Error ? err.message : err);
    return NextResponse.json({ configured: true, rows: [], error: 'Could not reach the database.' }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  if (!isDatabaseConfigured()) return NextResponse.json({ configured: false, saved: false });
  try {
    const report = await req.json();
    if (!report?.booking?.bookingId || !Array.isArray(report.items) || !Array.isArray(report.findings)) {
      return NextResponse.json({ error: 'Not a booking report.' }, { status: 400 });
    }
    await saveBookingReport(report);
    return NextResponse.json({ configured: true, saved: true });
  } catch (err) {
    console.error('Failed to save booking:', err instanceof Error ? err.message : err);
    return NextResponse.json({ configured: true, saved: false, error: 'Could not save.' }, { status: 502 });
  }
}
