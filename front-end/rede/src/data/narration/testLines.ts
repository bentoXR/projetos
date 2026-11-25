import type { NarrationCatalog } from './types';

/**
 * Sample narration lines used by the temporary SystemsTestScene.
 * All visible game copy stays in Brazilian Portuguese, keeping the friendly,
 * brief tone defined in docs/GAME_BIBLE.md.
 */
export const TEST_NARRATION_LINES: NarrationCatalog = {
  'test.welcome': {
    id: 'test.welcome',
    text: 'Tudo limpo por aqui. O palco está pronto.',
    variations: [
      'Espaço vazio. O melhor lugar para uma ideia começar.',
      'Silêncio no palco. Vamos testar um pedaço de cada vez.',
    ],
  },
  'test.silence_followup': {
    id: 'test.silence_followup',
    text: 'Viu? Às vezes o silêncio também faz parte da história.',
    variations: [
      'Uma pausa curta ajuda a ideia a respirar.',
      'Depois do silêncio, uma frase curta basta.',
    ],
  },
  'test.drag_reject': {
    id: 'test.drag_reject',
    text: 'Opa — parece que bateu num muro invisível.',
    variations: [
      'Por aqui não passa. Que tal tentar do outro lado?',
      'Voltou! Esse lugar não aceita esse tipo de dado.',
    ],
  },
  'test.drag_accept': {
    id: 'test.drag_accept',
    text: 'Encaixou direitinho.',
    variations: ['No lugar certo.', 'Aí sim — bem guardado.'],
  },
  'test.voice_on': {
    id: 'test.voice_on',
    text: 'Voz do narrador ligada.',
    durationMs: 2200,
  },
  'test.voice_off': {
    id: 'test.voice_off',
    text: 'Só legenda agora.',
    durationMs: 2200,
  },
};
