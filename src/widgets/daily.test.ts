import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { todoItems, TODO_MAX } from './todo/CalmeTodo';
import { countdownTarget, parts } from './countdown/CalmeCountdown';
import { webpageProblem } from './webpage/CalmeWebpage';
import { NoteText } from './notes/CalmeNotes';

describe('to-do list', () => {
  it('keeps only well-formed tasks, bounded', () => {
    expect(todoItems([{ id: 'a', text: 'Water the plants', done: true }, { id: 'b', text: '  ' }, { text: 'no id' }, 'x', null, { id: 'c', text: 'Call', done: 'yes' }]))
      .toEqual([{ id: 'a', text: 'Water the plants', done: true }, { id: 'c', text: 'Call', done: false }]);
    expect(todoItems(Array.from({ length: 150 }, (_, index) => ({ id: `t${index}`, text: 'x' })))).toHaveLength(TODO_MAX);
    expect(todoItems('nope')).toEqual([]);
  });
});

describe('countdown', () => {
  it('reads a day or a day and time in local time, nothing else', () => {
    expect(countdownTarget('2028-01-01')).toBe(new Date(2028, 0, 1).getTime());
    expect(countdownTarget('2028-01-01T18:30')).toBe(new Date(2028, 0, 1, 18, 30).getTime());
    for (const value of ['2028-13-45', '01/01/2028', 42, '2028-01-01T18:30:00Z']) expect(countdownTarget(value)).toBeUndefined();
  });
  it('splits a duration into days, hours and minutes, either way in time', () => {
    expect(parts((2 * 1440 + 3 * 60 + 4) * 60_000)).toEqual({ days: 2, hours: 3, minutes: 4 });
    expect(parts(-90 * 60_000)).toEqual({ days: 0, hours: 1, minutes: 30 });
  });
});

describe('web page', () => {
  const origin = 'https://dash.example.com';
  it('shows only http(s) pages of another origin, and says why not otherwise', () => {
    expect(webpageProblem('https://status.example.com', origin)).toBeNull();
    expect(webpageProblem('', origin)).toBe('missing');
    expect(webpageProblem('javascript:alert(1)', origin)).toBe('invalid');
    expect(webpageProblem('https://user:pass@status.example.com', origin)).toBe('invalid');
    expect(webpageProblem('https://dash.example.com/api/config', origin)).toBe('self');
    expect(webpageProblem('http://camera.example.com', origin)).toBe('insecure');
    expect(webpageProblem('http://camera.example.com', 'http://192.0.2.10:3000')).toBeNull();
  });
});

describe('notes', () => {
  it('understands headings, lists, bold and links, and never reads HTML', () => {
    const html = renderToStaticMarkup(React.createElement(NoteText, { text: '# Plan\n- **Backup** the NAS\n- See https://docs.example.com/guide.\n\n<script>alert(1)</script>' }));
    expect(html).toContain('<h4>Plan</h4>');
    expect(html).toContain('<li><strong>Backup</strong> the NAS</li>');
    expect(html).toContain('<a href="https://docs.example.com/guide" target="_blank" rel="noreferrer noopener">docs.example.com/guide</a>.');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
  });
});
