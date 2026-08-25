/**
 * Invisible-character text cleaner (clean-room).
 *
 * LLM output frequently carries invisible provenance/watermark characters:
 * zero-width spaces, word joiners, variation selectors, Unicode "tag" chars,
 * and private-use code points. None of these are ever meant to appear in
 * normal human prose. They break RTL rendering, copy/paste, search, diffing,
 * and length checks — and they mark text as machine-generated.
 *
 * This strips those characters. It does NOT rewrite, reword, or restructure
 * text — the actual wording is left exactly as-is.
 *
 * RTL/Hebrew note: bidi control characters (LRM/RLM, directional isolates and
 * overrides) ARE sometimes legitimate in Hebrew/mixed-direction text, so they
 * are NOT removed by default. Pass { stripBidi: true } only for text you know
 * should contain no bidi controls.
 *
 * Zero dependencies. Safe in browser, Node, and edge runtimes.
 */

export interface CleanTextOptions {
  /** Also remove bidi controls (LRM/RLM, isolates, overrides). Default: false. */
  stripBidi?: boolean;
  /** Collapse runs of ASCII/Unicode whitespace introduced by removals. Default: false. */
  collapseWhitespace?: boolean;
}

export interface CleanTextResult {
  text: string;
  /** How many code points were removed. */
  removed: number;
  /** True if the input contained any invisible characters. */
  hadInvisible: boolean;
}

// Characters that are NEVER legitimate in normal prose — always removed.
// Expressed as a set of single-codepoint tests via ranges for compactness.
const ALWAYS_STRIP: Array<[number, number]> = [
  [0x200b, 0x200d], // zero-width space / non-joiner / joiner
  [0x2060, 0x2064], // word joiner, function application, invisible times/separator
  [0x2065, 0x2065], // reserved invisible
  [0x061c, 0x061c], // Arabic letter mark
  [0x180e, 0x180e], // Mongolian vowel separator
  [0xfeff, 0xfeff], // zero-width no-break space / BOM
  [0xfff0, 0xfff8], // reserved invisible
  [0x3164, 0x3164], // Hangul filler
  [0xffa0, 0xffa0], // halfwidth Hangul filler
  [0xfe00, 0xfe0f], // variation selectors 1-16
  [0xe0100, 0xe01ef], // variation selectors 17-256
  [0xe0000, 0xe007f], // Unicode tag characters (incl. language tag)
  [0xe0080, 0xe0fff], // tag-plane reservations
  [0xf0000, 0xffffd], // supplementary private-use area A
  [0x100000, 0x10fffd], // supplementary private-use area B
  [0xfdd0, 0xfdef], // noncharacters
];

// Bidi controls — legitimate in some RTL text, so opt-in only.
const BIDI_STRIP: Array<[number, number]> = [
  [0x200e, 0x200f], // LRM / RLM
  [0x202a, 0x202e], // embeddings + directional overrides
  [0x2066, 0x2069], // directional isolates
];

// Per-plane noncharacters U+xFFFE / U+xFFFF (0 <= plane <= 16).
function isPlaneNoncharacter(cp: number): boolean {
  const low = cp & 0xffff;
  return low === 0xfffe || low === 0xffff;
}

function inRanges(cp: number, ranges: Array<[number, number]>): boolean {
  for (const [lo, hi] of ranges) {
    if (cp >= lo && cp <= hi) return true;
  }
  return false;
}

/**
 * Remove invisible / watermark characters from text.
 * Leaves the actual wording untouched.
 */
export function cleanText(input: string, options: CleanTextOptions = {}): CleanTextResult {
  if (!input) return { text: input ?? '', removed: 0, hadInvisible: false };

  const { stripBidi = false, collapseWhitespace = false } = options;
  let removed = 0;
  let out = '';

  // Iterate by code point so surrogate-pair chars (tag/PUA planes) match correctly.
  for (const ch of input) {
    const cp = ch.codePointAt(0)!;
    if (
      inRanges(cp, ALWAYS_STRIP) ||
      isPlaneNoncharacter(cp) ||
      (stripBidi && inRanges(cp, BIDI_STRIP))
    ) {
      removed++;
      continue;
    }
    out += ch;
  }

  if (collapseWhitespace) {
    out = out.replace(/[ \t ]{2,}/g, ' ').replace(/[ \t]+\n/g, '\n');
  }

  return { text: out, removed, hadInvisible: removed > 0 };
}

/** Convenience: return the cleaned string only. */
export function clean(input: string, options?: CleanTextOptions): string {
  return cleanText(input, options).text;
}

/** True if the string contains any invisible/watermark characters. */
export function hasInvisible(input: string, options?: CleanTextOptions): boolean {
  return cleanText(input, options).hadInvisible;
}
