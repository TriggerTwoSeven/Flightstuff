import { neon } from '@neondatabase/serverless';
import type { BookingReport } from './schemas';

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  return neon(url);
}

/** Save or update one booking report. Table layout is in schema.sql. */
export async function saveBookingReport(report: BookingReport) {
  const sql = getDb();
  const b = report.booking;
  const summary = JSON.stringify(
    report.findings.filter(f => f.status !== 'pass').map(f => ({
      ruleId: f.ruleId, ruleName: f.ruleName, severity: f.severity, status: f.status, evidence: f.evidence,
    })),
  );

  await sql`
    INSERT INTO bookings (
      booking_id, seller_name, origin_city, origin_country,
      destination_city, destination_country, destination_type,
      ready_to_ship_date, seller_priority, pallets, cartons,
      total_declared_value, currency, total_gross_weight,
      status, findings_summary, carrier_recommendation
    ) VALUES (
      ${b.bookingId}, ${b.sellerName}, ${b.originCity}, ${b.originCountry},
      ${b.destinationCity}, ${b.destinationCountry}, ${b.destinationType},
      ${b.readyToShipDate}, ${b.sellerPriority}, ${b.pallets}, ${b.cartons},
      ${b.totalDeclaredValue}, ${b.currency}, ${b.totalGrossWeight},
      ${report.status}, ${summary}::jsonb, ${JSON.stringify(report.recommendation?.recommended ?? null)}::jsonb
    )
    ON CONFLICT (booking_id) DO UPDATE SET
      seller_name = EXCLUDED.seller_name,
      destination_city = EXCLUDED.destination_city,
      destination_country = EXCLUDED.destination_country,
      pallets = EXCLUDED.pallets,
      cartons = EXCLUDED.cartons,
      total_declared_value = EXCLUDED.total_declared_value,
      total_gross_weight = EXCLUDED.total_gross_weight,
      status = EXCLUDED.status,
      findings_summary = EXCLUDED.findings_summary,
      carrier_recommendation = EXCLUDED.carrier_recommendation
  `;

  await sql`DELETE FROM items WHERE booking_id = ${b.bookingId}`;
  await sql`DELETE FROM findings WHERE booking_id = ${b.bookingId}`;

  for (const item of report.items) {
    await sql`
      INSERT INTO items (booking_id, sku, description, quantity, unit_price, hs_code, country_of_origin, weight_per_unit, cartons, per_carton)
      VALUES (${b.bookingId}, ${item.sku}, ${item.description}, ${item.quantity}, ${item.unitPrice}, ${item.hsCode}, ${item.countryOfOrigin}, ${item.unitWeight}, ${item.cartons}, ${item.unitsPerCarton})
    `;
  }

  for (const f of report.findings) {
    await sql`
      INSERT INTO findings (booking_id, rule_id, rule_label, severity, status, message, affected_field, affected_sku)
      VALUES (${b.bookingId}, ${f.ruleId}, ${f.ruleName}, ${f.severity}, ${f.status}, ${f.evidence}, ${f.actual ?? null}, ${f.affectedItem?.sku ?? null})
    `;
  }
}

export async function getBookingHistory() {
  const sql = getDb();
  return sql`
    SELECT booking_id, seller_name, destination_country, status, pallets,
           total_declared_value, currency, created_at,
           findings_summary, carrier_recommendation
    FROM bookings
    ORDER BY created_at DESC
    LIMIT 50
  `;
}
