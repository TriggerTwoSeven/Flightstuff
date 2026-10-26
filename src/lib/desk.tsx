'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  buildReport,
  coerceInterpretation,
  interpretAnswer,
  newConversation,
  PLACEHOLDER_ID,
  runTurn,
  stateFromReport,
  type ConvState,
  type Reader,
} from './conversation';
import { getMissing, type MissingField } from './interpreter';
import { clearHistory, loadHistory, removeFromHistory, saveToHistory, type SavedBooking } from './history';
import { formatDDMMYYYY, todayInLondon } from './normalise';
import { generateBookingId } from './utils';
import type { BookingReport, DataIssue } from './schemas';

export type ChatMessage =
  | { id: number; role: 'user'; text: string }
  | {
      id: number;
      role: 'bot';
      captured: string[];
      calculated: string[];
      unsupported: string[];
      understood: boolean;
      reader: Reader;
      /** The one question asked next, with quick replies. */
      question: MissingField | null;
      remaining: number;
      /** Present once every required detail is in. */
      outcome: { status: BookingReport['status']; blockers: number; reviews: number; carrier: string | null } | null;
      /** Plain text for the opening message and error states. */
      note?: string;
    };

export interface BatchState {
  fileName: string;
  reports: BookingReport[];
  warnings: DataIssue[];
}

interface Desk {
  conv: ConvState;
  report: BookingReport | null;
  messages: ChatMessage[];
  pending: MissingField | null;
  thinking: boolean;
  /** `fresh` starts a new conversation with this message, ignoring the one in progress. */
  send: (text: string, opts?: { fresh?: boolean }) => Promise<void>;
  resetConversation: () => void;
  batch: BatchState | null;
  setBatch: (b: BatchState | null) => void;
  history: SavedBooking[];
  markReady: (source: SavedBooking['source'], report: BookingReport) => void;
  removeSaved: (key: string) => void;
  clearSaved: () => void;
  /** Replace a report after an edit or a one-press fix, wherever it lives. */
  updateReport: (where: 'chat' | 'batch' | 'saved', report: BookingReport, savedKey?: string) => void;
  toast: string | null;
  notify: (message: string) => void;
}

const DeskContext = createContext<Desk | null>(null);

export function useDesk(): Desk {
  const ctx = useContext(DeskContext);
  if (!ctx) throw new Error('useDesk must be used inside <DeskProvider>');
  return ctx;
}

let nextId = 1;
const id = () => nextId++;

export function DeskProvider({ children }: { children: ReactNode }) {
  const [conv, setConv] = useState<ConvState>(() => newConversation(PLACEHOLDER_ID));
  const [report, setReport] = useState<BookingReport | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pending, setPending] = useState<MissingField | null>(null);
  const [thinking, setThinking] = useState(false);
  const [batch, setBatch] = useState<BatchState | null>(null);
  const [history, setHistory] = useState<SavedBooking[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const aiOff = useRef(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // localStorage is only there in the browser, so history loads after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHistory(loadHistory());
  }, []);

  const notify = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }, []);

  const askAi = useCallback(async (text: string, state: ConvState) => {
    if (aiOff.current) return null;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 14000);
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          today: formatDDMMYYYY(todayInLondon()),
          context: { booking: state.booking, items: state.items.map(i => ({ description: i.description, quantity: i.quantity })) },
        }),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (!res.ok) return null;
      const json = await res.json();
      if (!json.ok) {
        if (json.reason === 'no-key') aiOff.current = true;
        return null;
      }
      return coerceInterpretation(json.data);
    } catch {
      return null;
    }
  }, []);

  const send = useCallback(
    async (raw: string, opts?: { fresh?: boolean }) => {
      const text = raw.trim();
      if (!text) return;
      const fresh = Boolean(opts?.fresh);
      const userMsg: ChatMessage = { id: id(), role: 'user', text };
      setMessages(m => (fresh ? [userMsg] : [...m, userMsg]));
      setThinking(true);

      const current = fresh ? newConversation(PLACEHOLDER_ID) : conv;
      const currentPending = fresh ? null : pending;
      const base: ConvState = current.booking.bookingId === PLACEHOLDER_ID
        ? { ...current, booking: { ...current.booking, bookingId: generateBookingId() } }
        : current;
      const quick = interpretAnswer(text, currentPending);
      const ai = quick ? null : await askAi(text, base);
      const turn = runTurn(base, text, currentPending, ai);

      const required = turn.missing.filter(m => m.required);
      const next = required[0] ?? null;
      const blockers = turn.report.findings.filter(f => f.severity === 'Red' && f.status === 'fail').length;
      const reviews = turn.report.findings.filter(
        f => !f.acknowledged && ((f.severity === 'Amber' && f.status === 'fail') || f.status === 'needs_clarification' || (f.severity === 'Red' && f.status === 'not_checked')),
      ).length;
      const rec = turn.report.recommendation?.recommended;

      setConv(turn.state);
      setReport(turn.report);
      setPending(next);
      setThinking(false);
      setMessages(m => [
        ...m,
        {
          id: id(),
          role: 'bot',
          captured: turn.captured,
          calculated: turn.calculated,
          unsupported: turn.unsupported,
          understood: turn.understood,
          reader: turn.reader,
          question: next,
          remaining: required.length,
          outcome: next ? null : { status: turn.report.status, blockers, reviews, carrier: rec ? `${rec.carrier}, ${rec.service}` : null },
        },
      ]);

      if (!next && turn.state.items.length > 0) {
        setHistory(saveToHistory('chat', turn.report));
      }
    },
    [conv, pending, askAi],
  );

  const resetConversation = useCallback(() => {
    setConv(newConversation(generateBookingId()));
    setReport(null);
    setMessages([]);
    setPending(null);
    setThinking(false);
  }, []);

  const updateReport = useCallback(
    (where: 'chat' | 'batch' | 'saved', updated: BookingReport, savedKey?: string) => {
      if (where === 'chat') {
        const nextState = stateFromReport(conv, updated);
        const rebuilt = buildReport(nextState);
        setConv(nextState);
        setReport(rebuilt);
        // Keep the next question in step with what the sheet now holds.
        const stillMissing = getMissing(updated.booking, updated.items).filter(m => m.required);
        setPending(stillMissing.find(m => m.key === pending?.key) ?? stillMissing[0] ?? null);
      } else if (where === 'batch') {
        setBatch(b => (b ? { ...b, reports: b.reports.map(r => (r.booking.bookingId === updated.booking.bookingId ? updated : r)) } : b));
      } else if (savedKey) {
        const entry = history.find(s => s.key === savedKey);
        if (entry) setHistory(saveToHistory(entry.source, updated));
      }
    },
    [conv, pending, history],
  );

  const markReady = useCallback(
    (source: SavedBooking['source'], r: BookingReport) => {
      setHistory(saveToHistory(source, r));
      notify(`${r.booking.bookingId} saved to History`);
    },
    [notify],
  );

  const removeSaved = useCallback((key: string) => setHistory(removeFromHistory(key)), []);
  const clearSaved = useCallback(() => setHistory(clearHistory()), []);

  const value = useMemo<Desk>(
    () => ({
      conv, report, messages, pending, thinking, send, resetConversation,
      batch, setBatch, history, markReady, removeSaved, clearSaved, updateReport, toast, notify,
    }),
    [conv, report, messages, pending, thinking, send, resetConversation, batch, history, markReady, removeSaved, clearSaved, updateReport, toast, notify],
  );

  return <DeskContext.Provider value={value}>{children}</DeskContext.Provider>;
}
