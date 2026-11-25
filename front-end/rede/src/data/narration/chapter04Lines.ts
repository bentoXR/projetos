import type { NarrationCatalog } from './types';

/**
 * Narration script for Chapter 4 (3:00–4:20): Second PC, invisible wall,
 * floppy disk deliveries across growing distances, and "sneakernet".
 */
export const CHAPTER_04_NARRATION: NarrationCatalog = {
  'ch4.colleague_needs_file': {
    id: 'ch4.colleague_needs_file',
    text: 'Seu colega precisa desse arquivo.',
    durationMs: 3200,
  },
  'ch4.lives_in_that_pc': {
    id: 'ch4.lives_in_that_pc',
    text: 'O arquivo mora naquele computador. E só nele.',
    durationMs: 3600,
  },
  'ch4.floppy_arrives': {
    id: 'ch4.floppy_arrives',
    text: 'Um disquete. Copia aqui, leva até lá.',
    durationMs: 3200,
  },
  'ch4.across_room': {
    id: 'ch4.across_room',
    text: 'Agora do outro lado da sala. Outro arquivo.',
    durationMs: 3000,
  },
  'ch4.another_floor': {
    id: 'ch4.another_floor',
    text: 'E se o colega estiver em outro andar?',
    durationMs: 3200,
  },
  'ch4.sneakernet': {
    id: 'ch4.sneakernet',
    text: 'Lento e cansativo, né? No passado, apelidaram isso de "sneakernet" — a rede de tênis.',
    durationMs: 4800,
  },
};
