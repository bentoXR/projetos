import type { NarrationCatalog } from './types';

/**
 * Narration script for Chapter 5 (4:20–5:00): The first cable, bits traveling
 * across the wire ("Isso é uma rede."), and the optional technical deep-dive.
 */
export const CHAPTER_05_NARRATION: NarrationCatalog = {
  'ch5.walk_alone': {
    id: 'ch5.walk_alone',
    text: 'E se o arquivo pudesse andar sozinho?',
    durationMs: 3200,
  },
  'ch5.this_is_a_network': {
    id: 'ch5.this_is_a_network',
    text: 'Duas máquinas conversando. Isso é uma rede.',
    durationMs: 3600,
  },
  'ch5.ask_dive': {
    id: 'ch5.ask_dive',
    text: 'Quer ver o que passa por dentro do cabo?',
    durationMs: 4200,
  },
  'ch5.dive_pulses': {
    id: 'ch5.dive_pulses',
    text: 'Por dentro não passam bolinhas: é um sinal alternando entre dois níveis — 1 e 0.',
    durationMs: 4600,
  },
  'ch5.dive_bits': {
    id: 'ch5.dive_bits',
    text: 'Cada pulso desses é um bit. Juntos, eles carregam qualquer arquivo.',
    durationMs: 4200,
  },
};
