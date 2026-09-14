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

export interface PhraseChunkerFlushResult {
  chunks: PhraseChunk[];
  didFinalize: boolean;
}

export interface PhraseChunker {
  push(delta: string): PhraseChunk[];
  flush(): PhraseChunkerFlushResult;
  cancel(): void;
}

interface PhraseLimits {
  minWords: number;
  maxWords: number;
}

const TITLES_AND_PERSONAL_SUFFIXES = /^(?:dr|jr|mr|mrs|ms|prof|sr|st)\.$/iu;
const BUSINESS_SUFFIXES = /^(?:co|corp|inc|ltd)\.$/iu;
const REFERENCE_ABBREVIATIONS =
  /^(?:approx|dept|est|etc|fig|misc|no|vs)\.$/iu;
const MONTH_ABBREVIATIONS =
  /^(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\.$/iu;

const CLOSING_PUNCTUATION =
  /["'\u00bb\u2019\u201d\u203a)\]}\uff09\u3011\u3009\u300b\u300f]+$/u;
const OPENING_PUNCTUATION =
  /^["'\u00ab\u2018\u201c\u2039([{\uff08\u3010\u3008\u300a\u300e]+/u;

function stripClosingPunctuation(token: string): string {
  return token.replace(CLOSING_PUNCTUATION, "");
}

function isTerminalBoundary(token: string): boolean {
  const core = stripClosingPunctuation(token);

  if (/[!?\u3002\uff01\uff1f]$/u.test(core)) {
    return true;
  }

  if (!core.endsWith(".")) {
    return false;
  }

  const unwrapped = core.replace(OPENING_PUNCTUATION, "");
  const isAbbreviation =
    /^(?:[a-z]\.){2,}$/iu.test(unwrapped) ||
    TITLES_AND_PERSONAL_SUFFIXES.test(unwrapped) ||
    BUSINESS_SUFFIXES.test(unwrapped) ||
    REFERENCE_ABBREVIATIONS.test(unwrapped) ||
    MONTH_ABBREVIATIONS.test(unwrapped);

  return !isAbbreviation;
}

function isSoftBoundary(token: string): boolean {
  return /[,;:\u3001\uff0c\uff1b\uff1a]$/u.test(
    stripClosingPunctuation(token),
  );
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
 * field reproduces the accepted input byte-for-byte. The first `flush` returns
 * `didFinalize: true` even when no text remains, giving downstream consumers an
 * explicit end-of-stream control signal. Later flushes return `didFinalize:
 * false`. `flush` and `cancel` close the chunker; text pushed afterward is
 * ignored.
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
  let state: "open" | "flushed" | "cancelled" = "open";

  function push(delta: string): PhraseChunk[] {
    if (state !== "open" || delta.length === 0) {
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

  function flush(): PhraseChunkerFlushResult {
    if (state !== "open") {
      return { chunks: [], didFinalize: false };
    }

    state = "flushed";
    if (pending.length === 0) {
      return { chunks: [], didFinalize: true };
    }

    const chunk: PhraseChunk = {
      text: pending,
      sequence: nextSequence,
      isFinal: true,
    };
    pending = "";
    nextSequence += 1;
    return { chunks: [chunk], didFinalize: true };
  }

  function cancel(): void {
    pending = "";
    if (state === "open") {
      state = "cancelled";
    }
  }

  return {
    push,
    flush,
    cancel,
  };
}
