import type { NarrationCatalog } from './types';

/**
 * Narration script for Chapter 1 (0:00–1:00): Desk, drawers, and bookshelf.
 * Friendly, concise Brazilian Portuguese lines matching docs/GAME_BIBLE.md.
 */
export const CHAPTER_01_NARRATION: NarrationCatalog = {
  'ch1.desk_intro': {
    id: 'ch1.desk_intro',
    text: 'Isto é uma mesa. E alguém precisa guardar informação nela.',
    durationMs: 3600,
  },
  'ch1.one_paper': {
    id: 'ch1.one_paper',
    text: 'Um papel. Fácil.',
    durationMs: 2200,
  },
  'ch1.drawer_full': {
    id: 'ch1.drawer_full',
    text: 'Encheu. Mais uma gaveta resolve.',
    variations: ['Gaveta cheia. Vamos abrir espaço para outra.'],
    durationMs: 2600,
  },
  'ch1.bookshelf_appears': {
    id: 'ch1.bookshelf_appears',
    text: 'Agora uma estante. Assim fica bem mais organizado.',
    variations: ['Uma estante inteira. Muito melhor.'],
    durationMs: 2900,
  },
  'ch1.drawer_already_full': {
    id: 'ch1.drawer_already_full',
    text: 'Essa gaveta já está cheia.',
    variations: ['Aqui não cabe mais — tente ao lado.'],
    durationMs: 2100,
  },
};
