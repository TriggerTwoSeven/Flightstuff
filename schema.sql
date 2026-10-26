-- Optional: shared booking history for ReadyRoute. Run once on your Neon database,
-- then set DATABASE_URL in Vercel. Without it, history stays in each visitor's browser.
CREATE TABLE IF NOT EXISTS bookings (
  booking_id text PRIMARY KEY,
  seller_name text, origin_city text, origin_country text,
  destination_city text, destination_country text, destination_type text,
  ready_to_ship_date text, seller_priority text,
  pallets numeric, cartons numeric, total_declared_value numeric, currency text,
  total_gross_weight numeric, incoterm text, insurance text, special_instructions text,
  status text, findings_summary jsonb, carrier_recommendation jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS items (
  id bigserial PRIMARY KEY, booking_id text REFERENCES bookings(booking_id) ON DELETE CASCADE,
  sku text, description text, quantity numeric, unit_price numeric, hs_code text,
  country_of_origin text, weight_per_unit numeric, cartons numeric, per_carton numeric
);
CREATE TABLE IF NOT EXISTS findings (
  id bigserial PRIMARY KEY, booking_id text REFERENCES bookings(booking_id) ON DELETE CASCADE,
  rule_id text, rule_label text, severity text, status text, message text,
  affected_field text, affected_sku text
);
