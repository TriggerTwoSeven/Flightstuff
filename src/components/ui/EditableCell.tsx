'use client';

import { useId, useState } from 'react';
import { formatField, parseFieldValue, type FieldDef } from '@/lib/edit';

interface Props {
  def: FieldDef;
  value: unknown;
  /** Called with the raw text. Return an error message to keep the editor open. */
  onCommit: (raw: string) => string | null;
  tag?: string;
  span?: boolean;
  readOnly?: boolean;
  display?: string;
}

/** One field on a booking sheet: shows its value, edits in place, checks what you type. */
export function EditableCell({ def, value, onCommit, tag, span, readOnly, display }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const errId = useId();
  const shown = display ?? formatField(def, value);

  const start = () => {
    setDraft(def.kind === 'money' || def.kind === 'kg' || def.kind === 'int' ? (value == null ? '' : String(value)) : String(value ?? ''));
    setError(null);
    setEditing(true);
  };

  const commit = (raw: string) => {
    const check = parseFieldValue(def, raw);
    if (!check.ok) {
      setError(check.error);
      return;
    }
    const msg = onCommit(raw);
    if (msg) setError(msg);
    else setEditing(false);
  };

  if (editing) {
    return (
      <div className={`cell editing${span ? ' span' : ''}`}>
        <label className="k" htmlFor={`${errId}-in`}>{def.label}{def.hint ? ` (${def.hint})` : ''}</label>
        {def.kind === 'enum' ? (
          <select
            id={`${errId}-in`}
            className="select"
            autoFocus
            value={draft}
            onChange={e => { setDraft(e.target.value); commit(e.target.value); }}
            onBlur={() => setEditing(false)}
            onKeyDown={e => { if (e.key === 'Escape') setEditing(false); }}
          >
            <option value="">Not set</option>
            {(def.options ?? []).map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        ) : (
          <input
            id={`${errId}-in`}
            className="input"
            autoFocus
            value={draft}
            inputMode={def.kind === 'text' || def.kind === 'date' ? 'text' : 'decimal'}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errId : undefined}
            onChange={e => { setDraft(e.target.value); setError(null); }}
            onBlur={() => commit(draft)}
            onKeyDown={e => {
              if (e.key === 'Enter') commit(draft);
              if (e.key === 'Escape') { setError(null); setEditing(false); }
            }}
          />
        )}
        {error && <span id={errId} className="err" role="alert">{error}</span>}
      </div>
    );
  }

  const content = (
    <>
      <span className="k">{def.label}{tag && <span className="tag">{tag}</span>}</span>
      <span className={`v${shown ? '' : ' empty'}`}>{shown || 'Not set'}</span>
    </>
  );

  if (readOnly) return <div className={`cell${span ? ' span' : ''}`}>{content}</div>;
  return (
    <button type="button" className={`cell${span ? ' span' : ''}`} onClick={start} aria-label={`Edit ${def.label}: ${shown || 'not set'}`}>
      {content}
    </button>
  );
}
