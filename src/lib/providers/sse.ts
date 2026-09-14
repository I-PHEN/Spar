import { checkAborted } from "./errors";

/** Incremental SSE framing; retain only the unfinished event, never the response. */
export async function* readSseData(
  body: ReadableStream<Uint8Array>,
  signal: AbortSignal,
): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let data: string[] = [];
  const cancel = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener("abort", cancel, { once: true });

  function consumeLine(line: string): string | undefined {
    if (line === "") {
      if (data.length === 0) return;
      const event = data.join("\n");
      data = [];
      return event;
    }
    if (line === "data" || line.startsWith("data:")) {
      const value = line.slice(5);
      data.push(value.startsWith(" ") ? value.slice(1) : value);
    }
  }

  try {
    while (true) {
      checkAborted(signal);
      const { done, value } = await reader.read();
      checkAborted(signal);
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      let match: RegExpExecArray | null;
      while ((match = /\r\n|\r|\n/.exec(buffer))) {
        // A CR at a chunk boundary may be the first half of CRLF.
        if (!done && match[0] === "\r" && match.index === buffer.length - 1) break;
        const line = buffer.slice(0, match.index);
        buffer = buffer.slice(match.index + match[0].length);
        checkAborted(signal);
        const event = consumeLine(line);
        if (event !== undefined) yield event;
      }
      if (done) {
        if (buffer) consumeLine(buffer);
        const event = consumeLine("");
        if (event !== undefined) {
          checkAborted(signal);
          yield event;
        }
        return;
      }
    }
  } finally {
    signal.removeEventListener("abort", cancel);
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
