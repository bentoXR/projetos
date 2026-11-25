import { CHAPTER_01_NARRATION } from './chapter01Lines';
import { CHAPTER_02_NARRATION } from './chapter02Lines';
import { CHAPTER_03_NARRATION } from './chapter03Lines';
import { CHAPTER_04_NARRATION } from './chapter04Lines';
import { CHAPTER_05_NARRATION } from './chapter05Lines';
import { CHAPTER_06_NARRATION } from './chapter06Lines';
import { TEST_NARRATION_LINES } from './testLines';
import type { NarrationCatalog, NarrationLine } from './types';

export type { NarrationCatalog, NarrationLine } from './types';

/**
 * Central narration catalog combining all chapter script modules.
 */
export const NARRATION_CATALOG: NarrationCatalog = {
  ...TEST_NARRATION_LINES,
  ...CHAPTER_01_NARRATION,
  ...CHAPTER_02_NARRATION,
  ...CHAPTER_03_NARRATION,
  ...CHAPTER_04_NARRATION,
  ...CHAPTER_05_NARRATION,
  ...CHAPTER_06_NARRATION,
};

export function getNarrationLine(id: string): NarrationLine | undefined {
  return NARRATION_CATALOG[id];
}
