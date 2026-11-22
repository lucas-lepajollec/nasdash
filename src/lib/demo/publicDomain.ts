/**
 * What the public demo's media widgets show: real works in the public domain
 * (silent films and serials, ragtime and jazz-age sheet music, classic novels,
 * early newspaper comics, photographs by NASA, the U.S. National Archives and
 * the Library of Congress), with
 * their real artwork in `public/demo/art/` (sources and licences in
 * `public/demo/art/CREDITS.md`). Nothing here is fetched from the internet.
 */
import { DEMO_ART } from './art';

export interface DemoFilm { slug: string; title: string; year: number; minutes: number }
export interface DemoSerial { slug: string; title: string; year: number; episodes: string[] }
export interface DemoAlbum { slug: string; title: string; artist: string; year: number; tracks: string[] }
export interface DemoBook { slug: string; title: string; author: string }
export interface DemoPhoto { slug: string; place: string }

export const DEMO_FILMS: readonly DemoFilm[] = [
  { slug: 'metropolis', title: 'Metropolis', year: 1927, minutes: 153 },
  { slug: 'the-general', title: 'The General', year: 1926, minutes: 79 },
  { slug: 'caligari', title: 'The Cabinet of Dr. Caligari', year: 1920, minutes: 77 },
  { slug: 'trip-to-the-moon', title: 'A Trip to the Moon', year: 1902, minutes: 13 },
  { slug: 'the-kid', title: 'The Kid', year: 1921, minutes: 68 },
  { slug: 'sherlock-jr', title: 'Sherlock Jr.', year: 1924, minutes: 45 },
  { slug: 'safety-last', title: 'Safety Last!', year: 1923, minutes: 70 },
  { slug: 'charade', title: 'Charade', year: 1963, minutes: 113 },
];

export const DEMO_SERIALS: readonly DemoSerial[] = [
  { slug: 'les-vampires', title: 'Les Vampires', year: 1915, episodes: ['The Severed Head', 'The Ring That Kills', 'The Red Codebook', 'The Spectre', 'The Dead Man’s Escape', 'Hypnotic Eyes', 'Satanas', 'The Thunder Master', 'The Poisoner', 'The Terrible Wedding'] },
  { slug: 'fantomas', title: 'Fantômas', year: 1913, episodes: ['In the Shadow of the Guillotine', 'Juve Against Fantômas', 'The Murderous Corpse', 'Fantômas Against Fantômas', 'The False Magistrate'] },
  { slug: 'judex', title: 'Judex', year: 1916, episodes: ['The Mysterious Shadow', 'The Expiation', 'The Fantastic Hound', 'The Secret of the Tomb', 'The Tragic Mill', 'The Licorice Kid'] },
  { slug: 'perils-of-pauline', title: 'The Perils of Pauline', year: 1914, episodes: ['Trial by Fire', 'The Goddess of the Far West', 'The Deadly Turning', 'A Watery Grave'] },
];

export const DEMO_ALBUMS: readonly DemoAlbum[] = [
  { slug: 'maple-leaf-rag', title: 'Maple Leaf Rag', artist: 'Scott Joplin', year: 1899, tracks: ['Maple Leaf Rag', 'Original Rags', 'Swipesy'] },
  { slug: 'rhapsody-in-blue', title: 'Rhapsody in Blue', artist: 'George Gershwin', year: 1924, tracks: ['Rhapsody in Blue', 'Swanee', 'Lullaby'] },
  { slug: 'alexanders-ragtime-band', title: 'Alexander’s Ragtime Band', artist: 'Irving Berlin', year: 1911, tracks: ['Alexander’s Ragtime Band', 'Everybody’s Doin’ It Now', 'When the Midnight Choo-Choo Leaves for Alabam’'] },
  { slug: 'st-louis-blues', title: 'St. Louis Blues', artist: 'W. C. Handy', year: 1914, tracks: ['St. Louis Blues', 'Memphis Blues', 'Yellow Dog Blues'] },
  { slug: 'the-entertainer', title: 'The Entertainer', artist: 'Scott Joplin', year: 1902, tracks: ['The Entertainer', 'Elite Syncopations', 'The Easy Winners'] },
  { slug: 'swanee', title: 'Swanee', artist: 'George Gershwin', year: 1919, tracks: ['Swanee', 'Nobody but You', 'Come to the Moon'] },
];

export const DEMO_BOOKS: readonly DemoBook[] = [
  { slug: 'pride-and-prejudice', title: 'Pride and Prejudice', author: 'Jane Austen' },
  { slug: 'moby-dick', title: 'Moby-Dick', author: 'Herman Melville' },
  { slug: 'great-gatsby', title: 'The Great Gatsby', author: 'F. Scott Fitzgerald' },
  { slug: 'dracula', title: 'Dracula', author: 'Bram Stoker' },
  { slug: 'wizard-of-oz', title: 'The Wonderful Wizard of Oz', author: 'L. Frank Baum' },
  { slug: 'alice', title: 'Alice’s Adventures in Wonderland', author: 'Lewis Carroll' },
  { slug: 'frankenstein', title: 'Frankenstein', author: 'Mary Shelley' },
];

export const DEMO_COMICS: readonly DemoBook[] = [
  { slug: 'little-nemo', title: 'Little Nemo in Slumberland', author: 'Winsor McCay' },
  { slug: 'yellow-kid', title: 'The Yellow Kid', author: 'R. F. Outcault' },
  { slug: 'rarebit-fiend', title: 'Dream of the Rarebit Fiend', author: 'Winsor McCay' },
  { slug: 'little-nemo-2', title: 'Little Nemo in Slumberland: 1906', author: 'Winsor McCay' },
  { slug: 'mutt-and-jeff', title: 'Mutt and Jeff in Havana', author: 'Bud Fisher' },
  { slug: 'yellow-kid-2', title: 'The Yellow Kid at Sea', author: 'R. F. Outcault' },
  { slug: 'little-nemo-3', title: 'Little Nemo in Slumberland: 1907', author: 'Winsor McCay' },
];

export const DEMO_PHOTOS: readonly DemoPhoto[] = [
  { slug: 'tetons', place: 'Grand Teton' },
  { slug: 'earthrise', place: 'Apollo 8' },
  { slug: 'lauterbrunnen', place: 'Lauterbrunnen' },
  { slug: 'blue-marble', place: 'Apollo 17' },
  { slug: 'matterhorn', place: 'Zermatt' },
  { slug: 'jungfrau', place: 'Jungfrau' },
];

/** Where a demo picture is served from, or undefined when it has none (the generated art stands in). */
export function demoArtUrl(slug: string, shape: 'poster' | 'wide' | 'cover' | 'tall' = 'poster'): string | undefined {
  const name = shape === 'poster' || shape === 'cover' ? slug : `${slug}-${shape}`;
  return DEMO_ART.has(name) ? `/demo/art/${name}.webp` : undefined;
}

/**
 * The id a demo item carries for its picture (`demo:art:<slug>[:<shape>]`),
 * turned into a file by the image routes (see `demoArtFor`).
 */
export const demoArtId = (slug: string, shape?: 'wide' | 'tall') => `demo:art:${slug}${shape ? `:${shape}` : ''}`;

/** The file of a `demo:art:` id, when the demo ships one. */
export function demoArtFor(id: string): string | undefined {
  const match = /^demo:art:([a-z0-9-]+)(?::(wide|tall))?$/.exec(id);
  if (!match) return undefined;
  return demoArtUrl(match[1], (match[2] as 'wide' | 'tall' | undefined) ?? 'poster');
}
