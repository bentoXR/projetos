/**
 * Fixed visual palette defined in docs/GAME_BIBLE.md.
 * Every color carries a strict semantic role across the entire experience.
 */
export const PALETTE_HEX = {
  background: '#FAFAF7',
  stroke: '#1F2430',
  data: '#4F8CFF',
  problem: '#FF6B5E',
  solution: '#3DCC9A',
  highlight: '#FFC93C',
} as const;

/**
 * Numeric equivalents for Phaser Graphics and Canvas drawing APIs.
 */
export const PALETTE = {
  background: 0xfafaf7,
  stroke: 0x1f2430,
  data: 0x4f8cff,
  problem: 0xff6b5e,
  solution: 0x3dcc9a,
  highlight: 0xffc93c,
} as const;

/**
 * Mixes a palette color toward the off-white stage background (#FAFAF7)
 * to produce soft, flat tints without introducing outside hues.
 */
export function deriveSoftTint(color: number, whiteRatio = 0.72): number {
  const r1 = (color >> 16) & 0xff;
  const g1 = (color >> 8) & 0xff;
  const b1 = color & 0xff;

  const r2 = (PALETTE.background >> 16) & 0xff;
  const g2 = (PALETTE.background >> 8) & 0xff;
  const b2 = PALETTE.background & 0xff;

  const r = Math.round(r1 + (r2 - r1) * whiteRatio);
  const g = Math.round(g1 + (g2 - g1) * whiteRatio);
  const b = Math.round(b1 + (b2 - b1) * whiteRatio);

  return (r << 16) | (g << 8) | b;
}

/**
 * Soft paper colors strictly derived from the fixed palette.
 */
export const PAPER_TINTS = [
  deriveSoftTint(PALETTE.data, 0.7),
  deriveSoftTint(PALETTE.highlight, 0.72),
  deriveSoftTint(PALETTE.solution, 0.74),
  deriveSoftTint(PALETTE.problem, 0.78),
] as const;
