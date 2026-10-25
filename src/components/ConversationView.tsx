'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { Booking, Item, BookingReport } from '@/lib/schemas';
import type { LLMExtraction } from '@/lib/schemas';
import { fallbackParse } from '@/lib/interpreter';
import { evaluateBooking } from '@/lib/evaluate';
import { generateBookingId, generateSku, formatCurrency } from '@/lib/utils';
import { ORIGIN_COUNTRY } from '@/lib/constants';
import { StatusBadge } from '@/components/StatusBadge';
import { FindingsPanel } from '@/components/FindingsPanel';
import { CarrierRecommendation } from '@/components/CarrierRecommendation';
import Decimal from 'decimal.js';

interface Props {
  onBack: () => void;
  onViewReport: (report: BookingReport) => void;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const SAMPLE_TEXT = `I run Northfield Goods. Need to send ceramic mugs from Manchester to a warehouse in Frankfurt. Three pallets ready 05-11-2026. Each mug is £5 and we have 1,080 units, 12 per carton. Each mug weighs 0.5 kg. Total gross weight is 620 kg. HS code 691200. Made in the UK. Priority is cheapest. Appointment is booked.`;

export function ConversationView({ onBack, onViewReport }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [booking, setBooking] = useState<Partial<Booking>>({
    bookingId: generateBookingId(),
    originCountry: ORIGIN_COUNTRY,
    currency: 'GBP',
  });
  const [items, setItems] = useState<Partial<Item>[]>([]);
  const [report, setReport] = useState<BookingReport | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages, isTyping]);

  const buildFullBooking = useCallback((partial: Partial<Booking>): Booking => ({
    bookingId: partial.bookingId || generateBookingId(),
    sellerName: partial.sellerName || '',
    originCity: partial.originCity || '',
    originCountry: partial.originCountry || ORIGIN_COUNTRY,
    destinationCity: partial.destinationCity || '',
    destinationCountry: partial.destinationCountry || '',
    destinationType: partial.destinationType || '',
    readyToShipDate: partial.readyToShipDate || '',
    sellerPriority: partial.sellerPriority || '',
    pallets: partial.pallets ?? null,
    cartons: partial.cartons ?? null,
    totalDeclaredValue: partial.totalDeclaredValue ?? null,
    currency: partial.currency || 'GBP',
    totalGrossWeight: partial.totalGrossWeight ?? null,
    deliveryAppointmentBooked: partial.deliveryAppointmentBooked || '',
  }), []);

  const buildFullItems = useCallback((partials: Partial<Item>[], bookingId: string): Item[] =>
    partials.map(p => ({
      bookingId,
      sku: p.sku || generateSku(p.description || 'ITEM'),
      description: p.description || '',
      hsCode: p.hsCode ?? null,
      quantity: p.quantity ?? null,
      unitPrice: p.unitPrice ?? null,
      unitsPerCarton: p.unitsPerCarton ?? null,
      cartons: p.cartons ?? null,
      unitWeight: p.unitWeight ?? null,
      countryOfOrigin: p.countryOfOrigin ?? null,
    })), []);

  const recalculate = useCallback((b: Partial<Booking>, its: Partial<Item>[]) => {
    const fullBooking = buildFullBooking(b);
    const fullItems = buildFullItems(its, fullBooking.bookingId);
    const r = evaluateBooking(fullBooking, fullItems);
    setReport(r);
    return r;
  }, [buildFullBooking, buildFullItems]);

  const processMessage = useCallback(async (text: string) => {
    const currentExtracted: Partial<LLMExtraction['extracted']> = {
      sellerName: booking.sellerName,
      originCity: booking.originCity,
      destinationCity: booking.destinationCity,
      destinationCountry: booking.destinationCountry,
      destinationType: booking.destinationType,
      readyToShipDate: booking.readyToShipDate,
      sellerPriority: booking.sellerPriority,
      pallets: booking.pallets ?? undefined,
      totalGrossWeight: booking.totalGrossWeight ?? undefined,
      totalDeclaredValue: booking.totalDeclaredValue ?? undefined,
      deliveryAppointmentBooked: booking.deliveryAppointmentBooked,
      items: items.map(i => ({
        sku: i.sku,
        description: i.description,
        hsCode: i.hsCode ?? undefined,
        quantity: i.quantity ?? undefined,
        unitPrice: i.unitPrice ?? undefined,
        unitsPerCarton: i.unitsPerCarton ?? undefined,
        cartons: i.cartons ?? undefined,
        unitWeight: i.unitWeight ?? undefined,
        countryOfOrigin: i.countryOfOrigin ?? undefined,
      })),
    };

    let ext: LLMExtraction['extracted'];
    let missingFields: string[] | undefined;
    let usedGemini = false;

    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, context: currentExtracted }),
      });
      if (!res.ok) throw new Error('API error');
      const geminiData = await res.json();
      if (geminiData.error) throw new Error(geminiData.error);

      const b = geminiData.booking || {};
      const geminiItems = geminiData.items || [];
      ext = {
        sellerName: b.sellerName || undefined,
        originCity: b.originCity || undefined,
        destinationCity: b.destinationCity || undefined,
        destinationCountry: b.destinationCountry || undefined,
        destinationType: b.destinationType || undefined,
        readyToShipDate: b.readyToShipDate || undefined,
        sellerPriority: b.sellerPriority || undefined,
        pallets: b.pallets ?? undefined,
        totalGrossWeight: b.totalGrossWeight ?? undefined,
        totalDeclaredValue: b.totalDeclaredValue ?? undefined,
        deliveryAppointmentBooked: b.deliveryAppointmentBooked || b.appointmentBooked || undefined,
        items: geminiItems.map((gi: Record<string, unknown>) => ({
          description: (gi.description as string) || undefined,
          hsCode: (gi.hsCode as string) || undefined,
          quantity: (gi.quantity as number) ?? undefined,
          unitPrice: (gi.unitPrice as number) ?? undefined,
          unitsPerCarton: (gi.perCarton as number) ?? undefined,
          cartons: (gi.cartons as number) ?? undefined,
          unitWeight: (gi.weightPerUnit as number) ?? undefined,
          countryOfOrigin: (gi.countryOfOrigin as string) || undefined,
        })),
      };
      usedGemini = true;
    } catch {
      const result = fallbackParse(text, currentExtracted);
      ext = result.extracted;
      missingFields = result.missing;
    }

    const updatedBooking = { ...booking };
    if (ext.sellerName) updatedBooking.sellerName = ext.sellerName;
    if (ext.originCity) updatedBooking.originCity = ext.originCity;
    if (ext.destinationCity) updatedBooking.destinationCity = ext.destinationCity;
    if (ext.destinationCountry) updatedBooking.destinationCountry = ext.destinationCountry;
    if (ext.destinationType) updatedBooking.destinationType = ext.destinationType;
    if (ext.readyToShipDate) updatedBooking.readyToShipDate = ext.readyToShipDate;
    if (ext.sellerPriority) updatedBooking.sellerPriority = ext.sellerPriority;
    if (ext.pallets != null) updatedBooking.pallets = ext.pallets;
    if (ext.totalGrossWeight != null) updatedBooking.totalGrossWeight = ext.totalGrossWeight;
    if (ext.totalDeclaredValue != null) updatedBooking.totalDeclaredValue = ext.totalDeclaredValue;
    if (ext.deliveryAppointmentBooked) updatedBooking.deliveryAppointmentBooked = ext.deliveryAppointmentBooked;

    let updatedItems = [...items];
    if (ext.items && ext.items.length > 0) {
      for (const newItem of ext.items) {
        const existing = updatedItems.findIndex(
          i => i.description?.toLowerCase() === newItem.description?.toLowerCase()
        );
        if (existing >= 0) {
          updatedItems[existing] = { ...updatedItems[existing], ...newItem };
        } else {
          updatedItems.push({
            bookingId: updatedBooking.bookingId,
            sku: newItem.sku || generateSku(newItem.description || 'ITEM'),
            ...newItem,
          });
        }
      }
    }

    const suggestions: string[] = [];
    for (const item of updatedItems) {
      if (item.quantity != null && item.unitPrice != null) {
        const lineValue = new Decimal(item.quantity).times(new Decimal(item.unitPrice));
        suggestions.push(`${item.description}: ${item.quantity} x £${item.unitPrice} = ${formatCurrency(lineValue.toNumber())}`);
      }
      if (item.quantity != null && item.unitsPerCarton != null && item.unitsPerCarton > 0) {
        const calcCartons = Math.ceil(item.quantity / item.unitsPerCarton);
        if (item.cartons == null) {
          item.cartons = calcCartons;
          suggestions.push(`Calculated cartons for ${item.description}: ${item.quantity} / ${item.unitsPerCarton} = ${calcCartons}`);
        }
      }
    }

    const totalItemCartons = updatedItems.reduce((s, i) => s + (i.cartons ?? 0), 0);
    if (updatedBooking.cartons == null && totalItemCartons > 0) {
      updatedBooking.cartons = totalItemCartons;
      suggestions.push(`Calculated booking cartons: ${totalItemCartons}`);
    }

    if (updatedBooking.totalDeclaredValue == null && updatedItems.length > 0 &&
        updatedItems.every(i => i.quantity != null && i.unitPrice != null)) {
      const calcValue = updatedItems.reduce((s, i) =>
        s.plus(new Decimal(i.quantity!).times(new Decimal(i.unitPrice!))), new Decimal(0));
      updatedBooking.totalDeclaredValue = calcValue.toNumber();
      suggestions.push(`Calculated declared value: ${formatCurrency(calcValue.toNumber())}`);
    }

    setBooking(updatedBooking);
    setItems(updatedItems);

    const r = recalculate(updatedBooking, updatedItems);

    let response = '';
    const capturedFields: string[] = [];
    if (ext.sellerName) capturedFields.push(`Seller: ${ext.sellerName}`);
    if (ext.originCity) capturedFields.push(`Origin: ${ext.originCity}`);
    if (ext.destinationCity) capturedFields.push(`Destination: ${ext.destinationCity}, ${ext.destinationCountry || updatedBooking.destinationCountry}`);
    if (ext.destinationType) capturedFields.push(`Type: ${ext.destinationType}`);
    if (ext.pallets != null) capturedFields.push(`Pallets: ${ext.pallets}`);
    if (ext.readyToShipDate) capturedFields.push(`Ship date: ${ext.readyToShipDate}`);
    if (ext.sellerPriority) capturedFields.push(`Priority: ${ext.sellerPriority}`);

    if (capturedFields.length > 0) {
      response += `Got it!${usedGemini ? ' (via Gemini AI)' : ''} I've captured:\n${capturedFields.map(f => `  ${f}`).join('\n')}\n\n`;
    }

    if (suggestions.length > 0) {
      response += `Calculated:\n${suggestions.map(s => `  ${s}`).join('\n')}\n\n`;
    }

    if (!usedGemini && missingFields && missingFields.length > 0) {
      response += `I still need a few things:\n${missingFields.map(m => `  ${m}`).join('\n')}`;
    } else {
      const redCount = r.findings.filter(f => f.severity === 'Red' && f.status === 'fail').length;
      const amberCount = r.findings.filter(f => f.severity === 'Amber' && f.status === 'fail').length;
      response += `All information captured! `;
      if (redCount > 0) {
        response += `There are ${redCount} blocker(s) to fix. `;
      }
      if (amberCount > 0) {
        response += `${amberCount} item(s) need review. `;
      }
      if (redCount === 0 && amberCount === 0) {
        response += `All checks passed! Your shipment is ready. `;
      }
      if (r.recommendation?.recommended) {
        const rec = r.recommendation.recommended;
        response += `\n\nRecommended: ${rec.carrier} ${rec.service} — ${formatCurrency(rec.totalCost)} total (${rec.transitDays}d, ${rec.onTimePercent}% on-time).`;
        if (r.recommendation.alternativeTradeoff) {
          response += `\nAlternative: ${r.recommendation.alternativeTradeoff}`;
        }
      }
    }

    if ((!missingFields || missingFields.length === 0) || usedGemini) {
      try {
        await fetch('/api/bookings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(r),
        });
      } catch {}
    }

    return response;
  }, [booking, items, recalculate]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text) return;

    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setInput('');
    setIsTyping(true);

    try {
      const response = await processMessage(text);
      setIsTyping(false);
      setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    } catch {
      setIsTyping(false);
      setMessages(prev => [...prev, { role: 'assistant', content: 'Something went wrong processing your message. Please try again.' }]);
    }
  }, [input, processMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFieldEdit = (field: string, value: string | number) => {
    const updated = { ...booking, [field]: value };
    setBooking(updated);
    recalculate(updated, items);
  };

  const hasData = booking.sellerName || items.length > 0;

  return (
    <div className="animate-fade-in">
      {/* Back button */}
      <button
        onClick={onBack}
        className="btn btn-ghost text-sm mb-4 -ml-2"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m15 18-6-6 6-6"/>
        </svg>
        Back
      </button>

      <div className="grid lg:grid-cols-5 gap-6">
        {/* Chat panel */}
        <div className="lg:col-span-3 flex flex-col" style={{ minHeight: '70vh' }}>
          <div className="card flex-1 overflow-hidden flex flex-col p-0">
            {/* Chat header */}
            <div className="px-5 py-3 border-b flex items-center gap-3" style={{ borderColor: 'var(--border)' }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--gradient-accent)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
              </div>
              <div>
                <div className="text-sm font-semibold" style={{ color: 'var(--fg)' }}>Booking Assistant</div>
                <div className="text-xs flex items-center gap-1.5" style={{ color: 'var(--fg-subtle)' }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--green)' }} />
                  {isTyping ? 'Typing...' : 'Online'}
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4" style={{ maxHeight: '58vh' }}>
              {messages.length === 0 && (
                <div className="text-center py-16 animate-fade-in">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-float"
                    style={{ background: 'var(--accent-light)' }}
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>
                    </svg>
                  </div>
                  <p className="text-base font-semibold mb-1.5" style={{ color: 'var(--fg)' }}>
                    Describe your shipment
                  </p>
                  <p className="text-sm mb-5 max-w-xs mx-auto" style={{ color: 'var(--fg-muted)' }}>
                    Tell me what you&apos;re shipping, where it&apos;s going, and I&apos;ll handle the rest.
                  </p>
                  <button
                    onClick={() => {
                      setInput(SAMPLE_TEXT);
                      inputRef.current?.focus();
                    }}
                    className="btn btn-secondary text-sm"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="5 3 19 12 5 21 5 3"/>
                    </svg>
                    Try a sample
                  </button>
                </div>
              )}

              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}
                >
                  {msg.role === 'assistant' && (
                    <div
                      className="w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center mr-2.5 mt-0.5"
                      style={{ background: 'var(--accent-light)' }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>
                      </svg>
                    </div>
                  )}
                  <div
                    className={`chat-bubble ${msg.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-system'}`}
                  >
                    {msg.content.split('\n').map((line, j) => (
                      <span key={j}>
                        {line.startsWith('**') && line.endsWith('**')
                          ? <strong>{line.replace(/\*\*/g, '')}</strong>
                          : line.startsWith('**')
                          ? <><strong>{line.split('**')[1]}</strong>{line.split('**').slice(2).join('**')}</>
                          : line
                        }
                        {j < msg.content.split('\n').length - 1 && <br />}
                      </span>
                    ))}
                  </div>
                </div>
              ))}

              {/* Typing indicator */}
              {isTyping && (
                <div className="flex justify-start animate-fade-in">
                  <div
                    className="w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center mr-2.5 mt-0.5"
                    style={{ background: 'var(--accent-light)' }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>
                    </svg>
                  </div>
                  <div className="chat-bubble chat-bubble-system">
                    <div className="flex items-center gap-1.5 px-1 py-0.5">
                      <span className="typing-dot" />
                      <span className="typing-dot" />
                      <span className="typing-dot" />
                    </div>
                  </div>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            {/* Input area */}
            <div className="border-t p-4" style={{ borderColor: 'var(--border)' }}>
              <div className="flex gap-3 items-end">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Describe your shipment..."
                  className="input flex-1 resize-none !rounded-xl"
                  rows={2}
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className="btn btn-primary h-[44px] px-5"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Side panel */}
        <div className="lg:col-span-2 space-y-4">
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-sm" style={{ color: 'var(--fg)' }}>Booking Summary</h3>
              {report && <StatusBadge status={report.status} />}
            </div>

            {!hasData ? (
              <div className="text-center py-8">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-3" style={{ background: 'var(--bg-muted)' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--fg-subtle)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
                  </svg>
                </div>
                <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>
                  Start describing your shipment to see details here.
                </p>
              </div>
            ) : (
              <div className="space-y-3 text-sm animate-fade-in">
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Booking ID" value={booking.bookingId} provenance="auto-generated" />
                  <Field label="Seller" value={booking.sellerName} editable onEdit={v => handleFieldEdit('sellerName', v)} />
                  <Field label="Origin" value={booking.originCity ? `${booking.originCity}, UK` : ''} editable onEdit={v => handleFieldEdit('originCity', v)} />
                  <Field label="Destination" value={booking.destinationCity ? `${booking.destinationCity}, ${booking.destinationCountry}` : ''} />
                  <Field label="Type" value={booking.destinationType} editable onEdit={v => handleFieldEdit('destinationType', v)} />
                  <Field label="Ship date" value={booking.readyToShipDate} editable onEdit={v => handleFieldEdit('readyToShipDate', v)} />
                  <Field label="Priority" value={booking.sellerPriority} editable onEdit={v => handleFieldEdit('sellerPriority', v)} />
                  <Field label="Pallets" value={booking.pallets?.toString()} editable onEdit={v => handleFieldEdit('pallets', Number(v))} />
                  <Field label="Cartons" value={booking.cartons?.toString()} provenance={booking.cartons ? 'calculated' : undefined} editable onEdit={v => handleFieldEdit('cartons', Number(v))} />
                  <Field label="Declared value" value={booking.totalDeclaredValue != null ? formatCurrency(booking.totalDeclaredValue) : ''} provenance={booking.totalDeclaredValue ? 'calculated' : undefined} editable onEdit={v => handleFieldEdit('totalDeclaredValue', Number(v.replace(/[£,]/g, '')))} />
                  <Field label="Gross weight" value={booking.totalGrossWeight != null ? `${booking.totalGrossWeight} kg` : ''} editable onEdit={v => handleFieldEdit('totalGrossWeight', Number(v.replace(/kg/gi, '').trim()))} />
                  <Field label="Appointment" value={booking.deliveryAppointmentBooked} editable onEdit={v => handleFieldEdit('deliveryAppointmentBooked', v)} />
                </div>

                {items.length > 0 && (
                  <div className="mt-3">
                    <h4 className="font-bold text-xs uppercase tracking-wider mb-2" style={{ color: 'var(--fg-muted)' }}>Products</h4>
                    {items.map((item, i) => (
                      <div key={i} className="rounded-xl p-3 mb-2 animate-fade-in" style={{ background: 'var(--bg-muted)', border: '1px solid var(--border)' }}>
                        <div className="font-semibold text-xs mb-1.5" style={{ color: 'var(--fg)' }}>
                          {item.sku} — {item.description}
                        </div>
                        <div className="grid grid-cols-2 gap-1 text-xs" style={{ color: 'var(--fg-muted)' }}>
                          <span>Qty: {item.quantity ?? '—'}</span>
                          <span>Price: {item.unitPrice != null ? `£${item.unitPrice}` : '—'}</span>
                          <span>HS: {item.hsCode ?? '—'}</span>
                          <span>Weight: {item.unitWeight != null ? `${item.unitWeight} kg` : '—'}</span>
                          <span>Per carton: {item.unitsPerCarton ?? '—'}</span>
                          <span>Cartons: {item.cartons ?? '—'}</span>
                          <span className="col-span-2">Origin: {item.countryOfOrigin ?? '—'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {report && (
            <div className="space-y-4 animate-slide-in-up">
              <FindingsPanel findings={report.findings} compact />
              {report.recommendation && <CarrierRecommendation recommendation={report.recommendation} compact />}
              <button
                onClick={() => onViewReport(report)}
                className="btn btn-primary w-full"
              >
                View full pre-flight report
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, provenance, editable, onEdit }: {
  label: string;
  value?: string | null;
  provenance?: string;
  editable?: boolean;
  onEdit?: (value: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(value || '');

  if (editing && editable && onEdit) {
    return (
      <div>
        <span className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--fg-subtle)' }}>{label}</span>
        <input
          autoFocus
          value={editValue}
          onChange={e => setEditValue(e.target.value)}
          onBlur={() => { onEdit(editValue); setEditing(false); }}
          onKeyDown={e => { if (e.key === 'Enter') { onEdit(editValue); setEditing(false); } }}
          className="input text-sm mt-0.5 !py-1 !px-2"
        />
      </div>
    );
  }

  return (
    <div
      className={`rounded-lg px-2 py-1.5 transition-colors ${editable ? 'cursor-pointer' : ''}`}
      style={editable ? { background: 'transparent' } : undefined}
      onMouseEnter={e => { if (editable) e.currentTarget.style.background = 'var(--bg-muted)'; }}
      onMouseLeave={e => { if (editable) e.currentTarget.style.background = 'transparent'; }}
      onClick={() => { if (editable) { setEditValue(value || ''); setEditing(true); } }}
    >
      <span className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--fg-subtle)' }}>{label}</span>
      <div className="flex items-center gap-1.5">
        <span className={`text-sm ${value ? 'font-medium' : 'italic'}`} style={{ color: value ? 'var(--fg)' : 'var(--fg-subtle)' }}>
          {value || 'Missing'}
        </span>
        {provenance && (
          <span
            className="text-[10px] px-1.5 py-0.5 rounded-md font-semibold"
            style={{
              background: provenance === 'calculated' ? 'var(--blue-light)' : 'var(--bg-muted)',
              color: provenance === 'calculated' ? 'var(--blue)' : 'var(--fg-subtle)',
            }}
          >
            {provenance === 'auto-generated' ? 'Auto' : 'Calc'}
          </span>
        )}
        {editable && (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--fg-subtle)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-auto opacity-0 group-hover:opacity-100">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        )}
      </div>
    </div>
  );
}
