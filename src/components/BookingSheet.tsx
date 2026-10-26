'use client';

import type { Booking, Item } from '@/lib/schemas';
import { BOOKING_FIELDS, ITEM_FIELDS, formatField } from '@/lib/edit';
import { EditableCell } from './ui/EditableCell';

interface Props {
  booking: Partial<Booking>;
  items: Partial<Item>[];
  derived?: { cartons: boolean; declaredValue: boolean; itemCartons: string[] };
  onBooking: (key: string, raw: string) => string | null;
  onItem: (sku: string, key: string, raw: string) => string | null;
}

const SPAN = new Set(['sellerName']);

/** The booking as a sheet of fields. Every value can be edited in place and is checked as you type it. */
export function BookingSheet({ booking, items, derived, onBooking, onItem }: Props) {
  return (
    <div className="stack" style={{ ['--gap' as string]: '20px' }}>
      <div className="sheet-grid">
        {BOOKING_FIELDS.map(def => {
          const value = (booking as Record<string, unknown>)[def.key];
          const isDest = def.key === 'destinationCity';
          return (
            <EditableCell
              key={def.key}
              def={def}
              value={value}
              span={SPAN.has(def.key)}
              display={isDest && booking.destinationCity ? `${booking.destinationCity}${booking.destinationCountry ? `, ${booking.destinationCountry}` : ''}` : undefined}
              tag={(def.key === 'cartons' && derived?.cartons) || (def.key === 'totalDeclaredValue' && derived?.declaredValue) ? 'Calculated' : undefined}
              onCommit={raw => onBooking(def.key, raw)}
            />
          );
        })}
      </div>

      {items.length > 0 && (
        <div>
          <h4 className="label" style={{ marginBottom: 8 }}>Products ({items.length})</h4>
          {items.map(item => (
            <div key={item.sku} className="product">
              <div className="small muted" style={{ fontWeight: 700 }}>{item.sku}</div>
              <div className="sheet-grid" style={{ marginTop: 6 }}>
                {ITEM_FIELDS.map(def => (
                  <EditableCell
                    key={def.key}
                    def={def}
                    span={def.key === 'description'}
                    value={(item as Record<string, unknown>)[def.key]}
                    display={formatField(def, (item as Record<string, unknown>)[def.key])}
                    tag={def.key === 'cartons' && item.sku && derived?.itemCartons.includes(item.sku) ? 'Calculated' : undefined}
                    onCommit={raw => onItem(item.sku!, def.key, raw)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
