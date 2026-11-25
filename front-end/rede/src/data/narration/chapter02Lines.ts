import type { NarrationCatalog } from './types';

/**
 * Narration script for Chapter 2 (1:00–2:10): Paper overload & searching for
 * "the blue paper from yesterday".
 * Short, friendly Brazilian Portuguese lines matching docs/GAME_BIBLE.md.
 */
export const CHAPTER_02_NARRATION: NarrationCatalog = {
  'ch2.getting_complicated': {
    id: 'ch2.getting_complicated',
    text: 'Hum. Isso está ficando... complicado.',
    durationMs: 3200,
  },
  'ch2.find_blue_paper': {
    id: 'ch2.find_blue_paper',
    text: 'Preciso daquele papel azul de ontem.',
    durationMs: 3400,
  },
  'ch2.drawer_empty_of_blue': {
    id: 'ch2.drawer_empty_of_blue',
    text: 'Aqui não está.',
    variations: ['Também não está nessa gaveta.'],
    durationMs: 1800,
  },
  'ch2.found_how_long': {
    id: 'ch2.found_how_long',
    text: 'Você achou. Mas quanto tempo levou?',
    durationMs: 3600,
  },
};
