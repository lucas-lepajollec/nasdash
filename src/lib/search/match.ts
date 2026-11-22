/**
 * Dashboard search: whether a widget's text matches what was typed.
 *
 * Case and accents are ignored ("debit" finds "Débit"), every word typed must
 * appear somewhere in the widget, in any order, and a longer word may carry
 * one typo ("jellyfn" still finds "Jellyfin"). The text is everything the
 * widget shows plus its names and labels (`widgetSearchText`).
 */

/** Lower case, without accents, separators turned into spaces. */
export function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}.:/@_-]+/gu, ' ')
    .trim();
}

/** The words of a query, normalised; empty when there is nothing to look for. */
export function searchTerms(query: string): string[] {
  return normalizeSearchText(query).split(' ').filter(Boolean);
}

/** Words this long or longer may differ by one letter (missing, extra, wrong or swapped). */
const TYPO_MIN_LENGTH = 5;

function withinOneEdit(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  if (a.length === b.length) {
    // One letter replaced, or two neighbours swapped.
    if (a.slice(i + 1) === b.slice(i + 1)) return true;
    return a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2);
  }
  const [longer, shorter] = a.length > b.length ? [a, b] : [b, a];
  return longer.slice(i + 1) === shorter.slice(i);
}

function termMatches(term: string, text: string, words: string[]): boolean {
  if (text.includes(term)) return true;
  if (term.length < TYPO_MIN_LENGTH) return false;
  // A typo in a word, or in the start of a longer word ("jellyfn" → "jellyfin", "promethus" → "prometheus-node").
  return words.some(word => withinOneEdit(term, word)
    || (word.length > term.length && withinOneEdit(term, word.slice(0, term.length)))
    || (word.length > term.length && withinOneEdit(term, word.slice(0, term.length + 1))));
}

/** Prepared text of one widget, searched by `textMatches`. */
export interface SearchableText {
  text: string;
  words: string[];
}

export function prepareSearchText(raw: string): SearchableText {
  const text = normalizeSearchText(raw);
  return { text, words: [...new Set(text.split(' ').filter(word => word.length >= TYPO_MIN_LENGTH - 1))] };
}

/** True when every term of the query is found in the text. */
export function textMatches(terms: string[], searchable: SearchableText): boolean {
  return terms.every(term => termMatches(term, searchable.text, searchable.words));
}

/**
 * The text a widget offers to the search: what it shows, and the labels of
 * its icons, images and links (an icon-only service still has its name).
 * Fields typed into (a note being written, the search itself) are left out.
 */
export function widgetSearchText(element: Element, extra: string[] = []): string {
  const parts = [...extra];
  // Text node by text node: neighbouring elements must not glue their words together ("Compute" + "Proxmox").
  const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.nodeValue?.trim()) parts.push(node.nodeValue);
  }
  element.querySelectorAll('[title], [aria-label], img[alt]').forEach(node => {
    for (const name of ['title', 'aria-label', 'alt']) {
      const value = node.getAttribute(name);
      if (value) parts.push(value);
    }
  });
  return parts.join(' ');
}
