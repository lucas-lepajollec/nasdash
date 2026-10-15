import { describe, expect, it } from 'vitest';
import { importBookmarkHtml } from './importHtml';

const file = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE><H1>Bookmarks</H1>
<DL><p>
  <DT><H3 ADD_DATE="1">Bookmarks bar</H3>
  <DL><p>
    <DT><A HREF="https://forge.example/" ADD_DATE="2">Forge &amp; CI</A>
    <DT><H3>Docs</H3>
    <DL><p>
      <DT><A HREF="https://docs.example/a">A</A>
      <DT><A HREF="javascript:alert(1)">Script</A>
    </DL><p>
  </DL><p>
  <DT><A HREF="https://news.example/">News</A>
  <DT><A HREF="https://user:pw@secret.example/">Secret</A>
</DL><p>`;

describe('browser bookmarks import', () => {
  let n = 0;
  const id = (kind: string) => `${kind}-${++n}`;
  it('keeps folders, nesting and http(s) links only', () => {
    const { items, skipped } = importBookmarkHtml(file, id);
    expect(items.map(item => [item.kind, item.title, item.parentId ? items.find(other => other.id === item.parentId)?.title : null])).toEqual([
      ['folder', 'Bookmarks bar', null],
      ['link', 'Forge & CI', 'Bookmarks bar'],
      ['folder', 'Docs', 'Bookmarks bar'],
      ['link', 'A', 'Docs'],
      ['link', 'News', null],
    ]);
    expect(skipped).toBe(2);
  });
  it('stops at the library limit', () => {
    const { items, skipped } = importBookmarkHtml(file, id, 498);
    expect(items).toHaveLength(2);
    expect(skipped).toBe(5);
  });
});
