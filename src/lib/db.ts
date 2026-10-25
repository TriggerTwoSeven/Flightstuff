import { neon } from '@neondatabase/serverless';

function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  return neon(url);
}

export async function saveBookingReport(report: {
  booking: Record<string, unknown>;
  items: Record<string, unknown>[];
  findings: Record<string, unknown>[];
  status: string;
  carrier?: Record<string, unknown> | null;
}) {
  const sql = getDb();
  const b = report.booking as Record<string, unknown>;

  await sql`
    INSERT INTO bookings (
      booking_id, seller_name, origin_city, origin_country,
      destination_city, destination_country, destination_type,
      ready_to_ship_date, seller_priority, pallets, cartons,
      total_declared_value, currency, total_gross_weight,
      incoterm, insurance, special_instructions, status,
      findings_summary, carrier_recommendation
    ) VALUES (
      ${b.bookingId as string}, ${b.sellerName as string}, ${b.originCity as string}, ${b.originCountry as string},
      ${b.destinationCity as string}, ${b.destinationCountry as string}, ${b.destinationType as string},
      ${b.readyToShipDate as string}, ${b.sellerPriority as string}, ${b.pallets as number}, ${b.cartons as number},
      ${b.totalDeclaredValue as number}, ${b.currency as string}, ${b.totalGrossWeight as number},
      ${b.incoterm as string}, ${b.insurance as string}, ${b.specialInstructions as string}, ${report.status},
      ${JSON.stringify(report.findings)}, ${JSON.stringify(report.carrier ?? null)}
    )
    ON CONFLICT (booking_id) DO UPDATE SET
      status = EXCLUDED.status,
      findings_summary = EXCLUDED.findings_summary,
      carrier_recommendation = EXCLUDED.carrier_recommendation
  `;

  for (const item of report.items) {
    await sql`
      INSERT INTO items (booking_id, sku, description, quantity, unit_price, hs_code, country_of_origin, weight_per_unit, cartons, per_carton)
      VALUES (${b.bookingId as string}, ${item.sku as string}, ${item.description as string}, ${item.quantity as number}, ${item.unitPrice as number}, ${item.hsCode as string}, ${item.countryOfOrigin as string}, ${item.weightPerUnit as number}, ${item.cartons as number}, ${item.perCarton as number})
      ON CONFLICT DO NOTHING
    `;
  }

  for (const f of report.findings) {
    await sql`
      INSERT INTO findings (booking_id, rule_id, rule_label, severity, status, message, affected_field, affected_sku)
      VALUES (${b.bookingId as string}, ${f.ruleId as string}, ${f.ruleLabel as string}, ${f.severity as string}, ${f.status as string}, ${f.message as string}, ${f.affectedField as string}, ${f.affectedSku as string})
    `;
  }
}

export async function getBookingHistory() {
  const sql = getDb();
  const rows = await sql`
    SELECT booking_id, seller_name, destination_country, status, pallets,
           total_declared_value, currency, created_at,
           findings_summary, carrier_recommendation
    FROM bookings
    ORDER BY created_at DESC
    LIMIT 50
  `;
  return rows;
}

export async function getBookingById(bookingId: string) {
  const sql = getDb();
  const [booking] = await sql`SELECT * FROM bookings WHERE booking_id = ${bookingId}`;
  if (!booking) return null;
  const items = await sql`SELECT * FROM items WHERE booking_id = ${bookingId}`;
  const findings = await sql`SELECT * FROM findings WHERE booking_id = ${bookingId}`;
  return { booking, items, findings };
}
