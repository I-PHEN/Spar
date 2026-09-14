export interface PhraseChunk {
  text: string;
  sequence: number;
  isFinal: boolean;
}

export interface PhraseChunkerOptions {
  firstPhraseMinWords?: number;
  firstPhraseMaxWords?: number;
  subsequentPhraseMinWords?: number;
  subsequentPhraseMaxWords?: number;
}

export interface PhraseChunker {
  push(delta: string): PhraseChunk[];
  flush(): PhraseChunk[];
  cancel(): void;
}

interface PhraseLimits {
  minWords: number;
  maxWords: number;
}

const ABBREVIATIONS = new Set([
  "dr.",
  "jr.",
  "mr.",
  "mrs.",
  "ms.",
  "prof.",
  "sr.",
  "st.",
  "vs.",
]);

const CLOSING_PUNCTUATION = /["'\u2019\u201d)\]}]+$/u;
const OPENING_PUNCTUATION = /^["'\u2018\u201c([{]+/u;

function stripClosingPunctuation(token: string): string {
  return token.replace(CLOSING_PUNCTUATION, "");
}

function isTerminalBoundary(token: string): boolean {
  const core = stripClosingPunctuation(token);

  if (/[!?]$/u.test(core)) {
    return true;
  }

  if (!core.endsWith(".")) {
    return false;
  }

  const unwrapped = core.replace(OPENING_PUNCTUATION, "");
  const lower = unwrapped.toLowerCase();
  return !ABBREVIATIONS.has(lower) && !/^(?:[a-z]\.){2,}$/iu.test(unwrapped);
}

function isSoftBoundary(token: string): boolean {
  return /[,;:]$/u.test(stripClosingPunctuation(token));
}

function resolveLimit(value: number | undefined, fallback: number): number {
  if (value === undefined) {
    return fallback;
  }

  if (!Number.isInteger(value) || value < 1) {
    throw new RangeError("Phrase word limits must be positive integers");
  }

  return value;
}

/**
 * Splits streamed model text without changing it. A token is considered stable
 * only after trailing whitespace arrives (or flush is called), so fragmented
 * words, decimals, abbreviations, and URLs remain intact. Boundary whitespace
 * belongs to the phrase before it; consequently joining every emitted `text`
 * field reproduces the accepted input byte-for-byte. `flush` and `cancel` close
 * the chunker and are idempotent; text pushed after either operation is ignored.
 */
export function createPhraseChunker(
  options: PhraseChunkerOptions = {},
): PhraseChunker {
  const firstLimits: PhraseLimits = {
    minWords: resolveLimit(options.firstPhraseMinWords, 4),
    maxWords: resolveLimit(options.firstPhraseMaxWords, 10),
  };
  const subsequentLimits: PhraseLimits = {
    minWords: resolveLimit(options.subsequentPhraseMinWords, 8),
    maxWords: resolveLimit(options.subsequentPhraseMaxWords, 16),
  };

  if (
    firstLimits.minWords > firstLimits.maxWords ||
    subsequentLimits.minWords > subsequentLimits.maxWords
  ) {
    throw new RangeError("Phrase minimum word counts cannot exceed their maximums");
  }

  let pending = "";
  let nextSequence = 0;
  let closed = false;

  function push(delta: string): PhraseChunk[] {
    if (closed || delta.length === 0) {
      return [];
    }

    pending += delta;

    const chunks: PhraseChunk[] = [];
    const stableToken = /\S+\s+/gu;
    let phraseStart = 0;
    let wordCount = 0;

    for (const match of pending.matchAll(stableToken)) {
      wordCount += 1;

      const token = match[0].trimEnd();
      const limits = nextSequence === 0 ? firstLimits : subsequentLimits;
      const endsPhrase =
        isTerminalBoundary(token) ||
        (wordCount >= limits.minWords && isSoftBoundary(token)) ||
        wordCount >= limits.maxWords;

      if (!endsPhrase) {
        continue;
      }

      const boundary = (match.index ?? 0) + match[0].length;
      chunks.push({
        text: pending.slice(phraseStart, boundary),
        sequence: nextSequence,
        isFinal: false,
      });
      nextSequence += 1;
      phraseStart = boundary;
      wordCount = 0;
    }

    pending = pending.slice(phraseStart);
    return chunks;
  }

  function flush(): PhraseChunk[] {
    if (closed) {
      return [];
    }

    closed = true;
    if (pending.length === 0) {
      return [];
    }

    const chunk: PhraseChunk = {
      text: pending,
      sequence: nextSequence,
      isFinal: true,
    };
    pending = "";
    nextSequence += 1;
    return [chunk];
  }

  function cancel(): void {
    pending = "";
    closed = true;
  }

  return {
    push,
    flush,
    cancel,
  };
}
