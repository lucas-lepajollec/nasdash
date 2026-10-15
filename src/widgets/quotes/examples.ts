import type { UiLanguage } from '@/i18n/messages';

/**
 * The quote shown while a widget has none of its own and no online source:
 * one public-domain line per interface language, in its original words.
 */
export const EXAMPLE_QUOTES: Record<UiLanguage, { text: string; author: string; work: string }> = {
  en: { text: 'To thine own self be true.', author: 'William Shakespeare', work: 'Hamlet' },
  fr: { text: 'Rien ne sert de courir ; il faut partir à point.', author: 'Jean de La Fontaine', work: 'Le Lièvre et la Tortue' },
  es: { text: 'Podrá no haber poetas; pero siempre habrá poesía.', author: 'Gustavo Adolfo Bécquer', work: 'Rimas, IV' },
  de: { text: 'Grau, teurer Freund, ist alle Theorie, und grün des Lebens goldner Baum.', author: 'Johann Wolfgang von Goethe', work: 'Faust I' },
  it: { text: 'Fatti non foste a viver come bruti, ma per seguir virtute e canoscenza.', author: 'Dante Alighieri', work: 'Inferno, XXVI' },
};
