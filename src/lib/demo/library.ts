/**
 * What the public demo's media widgets show: real, freely licensed works with
 * their real artwork in `public/demo/art/` (sources and licences in
 * `public/demo/art/CREDITS.md`): the open films of Blender Studio (CC BY),
 * classic novels in Standard Ebooks editions (CC0), the Pepper&Carrot comic
 * by David Revoy (CC BY 4.0) and NASA photographs (public domain). Nothing
 * here is fetched from the internet.
 */
import { DEMO_ART } from './art';

export interface DemoFilm { slug: string; title: string; year: number; minutes: number }
export interface DemoSerial { slug: string; title: string; year: number; episodes: string[] }
/** A soundtrack: its cover (`slug`) and the film it belongs to (its wide picture). */
export interface DemoAlbum { slug: string; film: string; title: string; artist: string; year: number; tracks: string[] }
export interface DemoBook { slug: string; title: string; author: string }
export interface DemoPhoto { slug: string; place: string }

export const DEMO_FILMS: readonly DemoFilm[] = [
  { slug: 'sprite-fright', title: 'Sprite Fright', year: 2021, minutes: 10 },
  { slug: 'spring', title: 'Spring', year: 2019, minutes: 8 },
  { slug: 'sintel', title: 'Sintel', year: 2010, minutes: 15 },
  { slug: 'tears-of-steel', title: 'Tears of Steel', year: 2012, minutes: 12 },
  { slug: 'cosmos-laundromat', title: 'Cosmos Laundromat', year: 2015, minutes: 12 },
  { slug: 'big-buck-bunny', title: 'Big Buck Bunny', year: 2008, minutes: 10 },
  { slug: 'coffee-run', title: 'Coffee Run', year: 2020, minutes: 3 },
  { slug: 'elephants-dream', title: 'Elephants Dream', year: 2006, minutes: 11 },
];

export const DEMO_SERIALS: readonly DemoSerial[] = [
  { slug: 'caminandes', title: 'Caminandes', year: 2013, episodes: ['Llama Drama', 'Gran Dillama', 'Llamigos'] },
  { slug: 'pepper-carrot', title: 'Pepper & Carrot', year: 2017, episodes: ['The Witches of Chaosah', 'The Dragon’s Tooth', 'The Picnic'] },
  { slug: 'agent-327', title: 'Agent 327', year: 2017, episodes: ['Operation Barbershop'] },
  { slug: 'daily-dweebs', title: 'The Daily Dweebs', year: 2017, episodes: ['The Daily Dweebs'] },
];

export const DEMO_ALBUMS: readonly DemoAlbum[] = [
  { slug: 'sintel-ost', film: 'sintel', title: 'Sintel (Original Soundtrack)', artist: 'Jan Morgenstern', year: 2010, tracks: ['Main Theme', 'The Dragon', 'End Credits'] },
  { slug: 'tears-of-steel-ost', film: 'tears-of-steel', title: 'Tears of Steel (Original Soundtrack)', artist: 'Joram Letwory', year: 2012, tracks: ['Main Theme', 'Amsterdam', 'End Credits'] },
  { slug: 'big-buck-bunny-ost', film: 'big-buck-bunny', title: 'Big Buck Bunny (Original Soundtrack)', artist: 'Jan Morgenstern', year: 2008, tracks: ['Main Theme', 'Morning', 'End Credits'] },
  { slug: 'elephants-dream-ost', film: 'elephants-dream', title: 'Elephants Dream (Original Soundtrack)', artist: 'Jan Morgenstern', year: 2006, tracks: ['Main Theme', 'The Machine', 'End Credits'] },
  { slug: 'spring-ost', film: 'spring', title: 'Spring (Original Soundtrack)', artist: 'Blender Studio', year: 2019, tracks: ['Main Theme', 'The Forest', 'End Credits'] },
  { slug: 'sprite-fright-ost', film: 'sprite-fright', title: 'Sprite Fright (Original Soundtrack)', artist: 'Blender Studio', year: 2021, tracks: ['Main Theme', 'Into the Woods', 'End Credits'] },
  { slug: 'cosmos-laundromat-ost', film: 'cosmos-laundromat', title: 'Cosmos Laundromat (Original Soundtrack)', artist: 'Blender Studio', year: 2015, tracks: ['Main Theme', 'The Island', 'End Credits'] },
  { slug: 'coffee-run-ost', film: 'coffee-run', title: 'Coffee Run (Original Soundtrack)', artist: 'Blender Studio', year: 2020, tracks: ['Main Theme', 'Espresso', 'End Credits'] },
  { slug: 'charge-ost', film: 'charge', title: 'Charge (Original Soundtrack)', artist: 'Blender Studio', year: 2022, tracks: ['Main Theme', 'Blackout', 'End Credits'] },
  { slug: 'wing-it-ost', film: 'wing-it', title: 'Wing It! (Original Soundtrack)', artist: 'Blender Studio', year: 2023, tracks: ['Main Theme', 'Take-Off', 'End Credits'] },
];

export const DEMO_BOOKS: readonly DemoBook[] = [
  { slug: 'pride-and-prejudice', title: 'Pride and Prejudice', author: 'Jane Austen' },
  { slug: 'moby-dick', title: 'Moby Dick', author: 'Herman Melville' },
  { slug: 'great-gatsby', title: 'The Great Gatsby', author: 'F. Scott Fitzgerald' },
  { slug: 'dracula', title: 'Dracula', author: 'Bram Stoker' },
  { slug: 'wizard-of-oz', title: 'The Wonderful Wizard of Oz', author: 'L. Frank Baum' },
  { slug: 'frankenstein', title: 'Frankenstein', author: 'Mary Shelley' },
];

export const DEMO_COMICS: readonly DemoBook[] = [
  { slug: 'pepper-carrot-39', title: 'Pepper&Carrot 39: The Tavern', author: 'David Revoy' },
  { slug: 'pepper-carrot-38', title: 'Pepper&Carrot 38: The Healer', author: 'David Revoy' },
  { slug: 'pepper-carrot-37', title: 'Pepper&Carrot 37: The Tears of the Phoenix', author: 'David Revoy' },
  { slug: 'pepper-carrot-35', title: 'Pepper&Carrot 35: The Reflection', author: 'David Revoy' },
  { slug: 'pepper-carrot-24', title: 'Pepper&Carrot 24: The Unity Tree', author: 'David Revoy' },
  { slug: 'pepper-carrot-15', title: 'Pepper&Carrot 15: The Crystal Ball', author: 'David Revoy' },
  { slug: 'pepper-carrot-14', title: 'Pepper&Carrot 14: The Dragon’s Tooth', author: 'David Revoy' },
];

export const DEMO_PHOTOS: readonly DemoPhoto[] = [
  { slug: 'bahamas', place: 'The Bahamas' },
  { slug: 'aurora', place: 'Northern lights' },
  { slug: 'grand-canyon', place: 'Grand Canyon' },
  { slug: 'himalayas', place: 'Himalayas' },
  { slug: 'earthset', place: 'Far side of the Moon' },
];

/** Where a demo picture is served from, or undefined when it has none (the drawn artwork stands in). */
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
