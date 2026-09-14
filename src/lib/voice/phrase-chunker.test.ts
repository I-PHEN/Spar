import { describe, expect, test } from "bun:test";
import { createPhraseChunker, type PhraseChunk } from "./phrase-chunker";

describe("phrase chunker", () => {
  test("waits for fragmented words and punctuation before emitting their exact text", () => {
    const chunker = createPhraseChunker();

    expect(chunker.push("Hel")).toEqual([]);
    expect(chunker.push("lo there")).toEqual([]);
    expect(chunker.push("! ")).toEqual([
      { text: "Hello there! ", sequence: 0, isFinal: false },
    ]);
  });

  test("uses commas and semicolons as natural boundaries after the preferred minimum", () => {
    const chunker = createPhraseChunker();
    const input =
      "One two three four, five six seven eight nine ten eleven twelve; " +
      "thirteen fourteen fifteen sixteen. ";

    expect(chunker.push(input)).toEqual([
      { text: "One two three four, ", sequence: 0, isFinal: false },
      {
        text: "five six seven eight nine ten eleven twelve; ",
        sequence: 1,
        isFinal: false,
      },
      {
        text: "thirteen fourteen fifteen sixteen. ",
        sequence: 2,
        isFinal: false,
      },
    ]);
  });

  test("recognizes terminal punctuation followed by closing quotes", () => {
    const chunker = createPhraseChunker();

    expect(chunker.push('She said, "Stop now!" Then wait. ')).toEqual([
      { text: 'She said, "Stop now!" ', sequence: 0, isFinal: false },
      { text: "Then wait. ", sequence: 1, isFinal: false },
    ]);
  });

  test("does not split abbreviations, decimals, or URLs fragmented across deltas", () => {
    const chunker = createPhraseChunker();
    const chunks: PhraseChunk[] = [];

    chunks.push(...chunker.push("Use e."));
    chunks.push(...chunker.push("g. 3."));
    chunks.push(...chunker.push("14 at https://exa"));
    chunks.push(...chunker.push("mple.com before we continue. "));

    expect(chunks).toEqual([
      {
        text: "Use e.g. 3.14 at https://example.com before we continue. ",
        sequence: 0,
        isFinal: false,
      },
    ]);
  });

  test("does not mistake a quoted or parenthesized abbreviation for a sentence end", () => {
    const chunker = createPhraseChunker();

    expect(chunker.push('Try (e.g.) the "U.S." version now. ')).toEqual([
      {
        text: 'Try (e.g.) the "U.S." version now. ',
        sequence: 0,
        isFinal: false,
      },
    ]);
  });

  test("keeps bounded categories of common multi-letter abbreviations intact", () => {
    const cases = [
      "Keep etc. examples here. ",
      "Acme Inc. records remain current. ",
      "See No. 7 now. ",
      "Wait approx. 3 minutes. ",
      "Meet Jan. 5 there. ",
      "Meet Sept. 12 there. ",
    ];

    for (const input of cases) {
      expect(createPhraseChunker().push(input)).toEqual([
        { text: input, sequence: 0, isFinal: false },
      ]);
    }
  });

  test("recognizes Unicode sentence and list punctuation inside guillemets", () => {
    const chunker = createPhraseChunker();
    const input =
      "\u00abUn deux trois quatre\uff0c\u00bb " +
      "cinq six sept huit neuf dix onze douze\uff1b " +
      "\u2039Arr\u00eatez\uff01\u203a Puis attendez\u3002 ";

    expect(chunker.push(input)).toEqual([
      {
        text: "\u00abUn deux trois quatre\uff0c\u00bb ",
        sequence: 0,
        isFinal: false,
      },
      {
        text: "cinq six sept huit neuf dix onze douze\uff1b ",
        sequence: 1,
        isFinal: false,
      },
      { text: "\u2039Arr\u00eatez\uff01\u203a ", sequence: 2, isFinal: false },
      { text: "Puis attendez\u3002 ", sequence: 3, isFinal: false },
    ]);
  });

  test("emits a long punctuation-free stream at the hard word ceilings", () => {
    const chunker = createPhraseChunker();
    const input =
      "one two three four five six seven eight nine ten " +
      "eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty " +
      "twenty-one twenty-two twenty-three twenty-four twenty-five twenty-six twenty-seven";

    const pushed = chunker.push(input);

    expect(pushed).toEqual([
      {
        text: "one two three four five six seven eight nine ten ",
        sequence: 0,
        isFinal: false,
      },
      {
        text:
          "eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty " +
          "twenty-one twenty-two twenty-three twenty-four twenty-five twenty-six ",
        sequence: 1,
        isFinal: false,
      },
    ]);
    expect(chunker.flush()).toEqual({
      chunks: [{ text: "twenty-seven", sequence: 2, isFinal: true }],
      didFinalize: true,
    });
  });

  test("allows terminal punctuation to close the first phrase before four words", () => {
    const chunker = createPhraseChunker();

    expect(chunker.push("Stop now! ")).toEqual([
      { text: "Stop now! ", sequence: 0, isFinal: false },
    ]);
  });

  test("preserves whitespace exactly and assigns boundary whitespace to the prior phrase", () => {
    const chunker = createPhraseChunker();
    const input =
      "  one\ttwo three four, \r\nfive six seven eight nine ten eleven twelve; \nlast";
    const pushed = chunker.push(input);
    const flushed = chunker.flush();
    const chunks = [...pushed, ...flushed.chunks];

    expect(chunks).toEqual([
      {
        text: "  one\ttwo three four, \r\n",
        sequence: 0,
        isFinal: false,
      },
      {
        text: "five six seven eight nine ten eleven twelve; \n",
        sequence: 1,
        isFinal: false,
      },
      { text: "last", sequence: 2, isFinal: true },
    ]);
    expect(chunks.map((chunk) => chunk.text).join("")).toBe(input);
    expect(flushed.didFinalize).toBe(true);
  });

  test("flush emits the remaining exact text once and closes the chunker", () => {
    const chunker = createPhraseChunker();

    expect(chunker.push("final unfinished thought")).toEqual([]);
    expect(chunker.flush()).toEqual({
      chunks: [
        { text: "final unfinished thought", sequence: 0, isFinal: true },
      ],
      didFinalize: true,
    });
    expect(chunker.flush()).toEqual({ chunks: [], didFinalize: false });
    expect(chunker.push(" ignored")).toEqual([]);
  });

  test("flush explicitly finalizes once when push already emitted all text", () => {
    const chunker = createPhraseChunker();

    expect(chunker.push("Done. ")).toEqual([
      { text: "Done. ", sequence: 0, isFinal: false },
    ]);
    expect(chunker.flush()).toEqual({ chunks: [], didFinalize: true });
    expect(chunker.flush()).toEqual({ chunks: [], didFinalize: false });
  });

  test("cancel discards only un-emitted text and is idempotent", () => {
    const chunker = createPhraseChunker();
    const emitted = chunker.push(
      "one two three four five six seven eight nine ten buffered remainder",
    );

    expect(emitted).toEqual([
      {
        text: "one two three four five six seven eight nine ten ",
        sequence: 0,
        isFinal: false,
      },
    ]);

    chunker.cancel();
    chunker.cancel();

    expect(chunker.flush()).toEqual({ chunks: [], didFinalize: false });
    expect(chunker.push(" ignored")).toEqual([]);
  });

  test("concatenated output equals arbitrarily fragmented input exactly", () => {
    const chunker = createPhraseChunker();
    const deltas = [
      "Alpha be",
      "ta gamma delta, ",
      "epsilon zeta eta theta iota kappa lambda mu; nu xi. ",
      "https://example.com/a.b remains 2.",
      "75 exactly",
    ];
    const chunks: PhraseChunk[] = [];

    for (const delta of deltas) {
      chunks.push(...chunker.push(delta));
    }
    const flushed = chunker.flush();
    chunks.push(...flushed.chunks);

    expect(chunks.map((chunk) => chunk.text).join("")).toBe(deltas.join(""));
    expect(chunks.map((chunk) => chunk.sequence)).toEqual([0, 1, 2, 3]);
    expect(chunks.map((chunk) => chunk.isFinal)).toEqual([
      false,
      false,
      false,
      true,
    ]);
    expect(flushed.didFinalize).toBe(true);
  });
});
