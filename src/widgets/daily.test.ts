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

import { lineSpeed } from './speedtest/CalmeSpeedtest';
import { folderActive, shownFolders } from './syncthing/CalmeSyncthing';
import { iconName, shownUpdates } from './container-updates/CalmeContainerUpdates';
import type { SyncthingFolder } from '@/lib/widgetData/contracts';

describe('kit widget settings', () => {
  it('tells a line speed in bits or bytes', () => {
    expect(lineSpeed(940_000_000, 'bits', 'en')).toEqual(['940', 'Mbit/s']);
    expect(lineSpeed(940_000_000, 'bytes', 'en')).toEqual(['118', 'MB/s']);
    expect(lineSpeed(2_400_000_000, 'bits', 'fr')).toEqual(['2,4', 'Gbit/s']);
  });
  it('shows the folders asked for, hidden ones left out', () => {
    const folder = (id: string, state: SyncthingFolder['state'], completion = 100, errors = 0): SyncthingFolder => ({ id, label: id, state, completion, needBytes: 0, globalBytes: 1, errors });
    const folders = [folder('docs', 'idle'), folder('photos', 'syncing', 60), folder('music', 'idle', 100, 2), folder('notes', 'paused')];
    expect(folders.filter(folderActive).map(item => item.id)).toEqual(['photos', 'music']);
    expect(shownFolders(folders, { folders: 'active' }).map(item => item.id)).toEqual(['photos', 'music']);
    expect(shownFolders(folders, { hiddenFolders: ['docs', 42], folders: 'all' }).map(item => item.id)).toEqual(['photos', 'music', 'notes']);
  });
  it('finds an app icon name from its image and can leave rebuilt images out', () => {
    expect(iconName('immich-app/immich-server')).toBe('immich');
    expect(iconName('ghcr.io/linuxserver/sonarr:latest')).toBe('sonarr');
    expect(iconName('library/postgres')).toBe('postgres');
    expect(iconName('../<script>')).toBeUndefined();
    const updates = [{ name: 'a', image: 'a', current: '1', kind: 'tag' as const }, { name: 'b', image: 'b', current: 'latest', kind: 'digest' as const }, { name: 'c', image: 'c', current: 'latest', kind: 'digest' as const, status: 'updating' as const }];
    expect(shownUpdates(updates, { digests: false }).map(update => update.name)).toEqual(['a', 'c']);
    expect(shownUpdates(updates, {})).toHaveLength(3);
  });
});
