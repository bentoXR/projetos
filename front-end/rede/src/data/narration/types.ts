export interface NarrationLine {
  id: string;
  /** Primary Brazilian Portuguese line. */
  text: string;
  /** Optional alternative phrasings to avoid sounding repetitive. */
  variations?: string[];
  /** Optional custom reading duration in milliseconds. */
  durationMs?: number;
}

export type NarrationCatalog = Record<string, NarrationLine>;
