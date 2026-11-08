'use client';

import React, { useRef, useState } from 'react';
import { Pencil } from 'lucide-react';
import type { WidgetSettings } from '@/lib/pages/types';
import { useConfig } from '@/hooks/useConfig';
import { useI18n } from '@/i18n/I18nProvider';
import { CalmeWidget } from '../calme';

export const NOTE_MAX = 4000;

/**
 * A short note, kept with the widget. An administrator writes it in place
 * (a click, then Escape or leaving the field); everyone else reads it. A few
 * marks are understood: `# ` a heading, `- ` a list item, `**bold**`, and web
 * addresses become links.
 */
export default function CalmeNotes({ settings, editMode, onUpdateSettings }: { settings: WidgetSettings; editMode: boolean; onUpdateSettings: (settings: WidgetSettings) => void }) {
  const { t } = useI18n();
  const { user } = useConfig();
  const admin = user?.role === 'admin';
  const text = typeof settings.text === 'string' ? settings.text : '';
  const [draft, setDraft] = useState<string | null>(null);
  const cancelled = useRef(false);
  const title = t('widget.notes.name');

  const open = () => { if (admin) { cancelled.current = false; setDraft(text); } };
  const commit = () => {
    if (draft === null) return;
    if (!cancelled.current && draft !== text) onUpdateSettings({ text: draft.slice(0, NOTE_MAX) || null });
    setDraft(null);
  };

  return (
    <CalmeWidget title={title} editMode={editMode}>
      {draft !== null ? (
        <textarea
          className="ndw-note-editor"
          autoFocus
          value={draft}
          maxLength={NOTE_MAX}
          placeholder={t('widgets.notes.placeholder')}
          aria-label={t('widgets.notes.edit')}
          data-no-widget-drag
          onChange={event => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={event => {
            if (event.key === 'Escape') { event.preventDefault(); cancelled.current = true; event.currentTarget.blur(); }
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) { event.preventDefault(); event.currentTarget.blur(); }
          }}
        />
      ) : (
        <div className={`ndw-notes ${admin ? 'is-editable' : ''}`}>
          {text.trim() ? <NoteText text={text} /> : <p className="ndw-media-sub is-quiet">{admin ? t('widgets.notes.empty') : t('widgets.notes.emptyViewer')}</p>}
          {admin && (
            <button type="button" className="ndc-icon-button ndw-notes-edit" onClick={open} aria-label={t('widgets.notes.edit')} title={t('widgets.notes.edit')} data-no-widget-drag>
              <Pencil size={12} />
            </button>
          )}
        </div>
      )}
    </CalmeWidget>
  );
}

const LINK = /(https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"])/g;
/** `**bold**` and web addresses inside one line. */
function Inline({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => part.startsWith('**') && part.endsWith('**') && part.length > 4
        ? <strong key={index}>{part.slice(2, -2)}</strong>
        : part.split(LINK).map((piece, inner) => /^https?:\/\//.test(piece)
          ? <a key={`${index}-${inner}`} href={piece} target="_blank" rel="noreferrer noopener">{piece.replace(/^https?:\/\//, '')}</a>
          : <React.Fragment key={`${index}-${inner}`}>{piece}</React.Fragment>))}
    </>
  );
}

/** Paragraphs, headings and lists; nothing is read as HTML. */
export function NoteText({ text }: { text: string }) {
  const blocks: React.ReactNode[] = [];
  let list: string[] = [], paragraph: string[] = [];
  const flush = () => {
    if (paragraph.length) blocks.push(<p key={blocks.length}>{paragraph.map((line, index) => <React.Fragment key={index}>{index > 0 && <br />}<Inline text={line} /></React.Fragment>)}</p>);
    if (list.length) blocks.push(<ul key={blocks.length}>{list.map((line, index) => <li key={index}><Inline text={line} /></li>)}</ul>);
    paragraph = []; list = [];
  };
  for (const line of text.split('\n')) {
    const item = /^\s*[-*]\s+(.*)$/.exec(line), heading = /^#{1,3}\s+(.*)$/.exec(line);
    if (item) { if (paragraph.length) flush(); list.push(item[1]); }
    else if (heading) { flush(); blocks.push(<h4 key={blocks.length}><Inline text={heading[1]} /></h4>); }
    else if (!line.trim()) flush();
    else { if (list.length) flush(); paragraph.push(line); }
  }
  flush();
  return <div className="ndw-notes-text">{blocks}</div>;
}
