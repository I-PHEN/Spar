// Spar — OpenRouter streaming LLM (SERVER-SIDE ONLY)
//
// Uses OpenRouter's OpenAI-compatible API with true token streaming.
// First token arrives in ~1-1.5s (vs z-ai's "all at once" 2.6s).
//
// The persona response is generated as JSON ({ content, type, claimRef, mood }).
// We stream the tokens, extract the "content" field as it arrives, detect
// sentence boundaries, and fire TTS for each sentence as it completes.

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
const MODEL = "minimax/minimax-m3:free";

export interface StreamedToken {
  /** The text content of this token */
  content: string;
  /** Whether this is the last token */
  done: boolean;
}

/**
 * Stream a persona response from OpenRouter.
 *
 * Yields individual text tokens as they arrive. The caller is responsible
 * for accumulating them and detecting sentence boundaries.
 *
 * @param systemPrompt The persona system prompt
 * @param userPrompt The user message + context
 * @returns An async generator that yields text tokens
 */
export async function* streamPersonaResponse(
  systemPrompt: string,
  userPrompt: string
): AsyncGenerator<StreamedToken, void, unknown> {
  if (!OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY is not set");
  }

  const response = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      stream: true,
      max_tokens: 150, // Hard cap — persona responses are 1-3 sentences max
      temperature: 0.5, // Lower temperature = more focused, less rambling
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error ${response.status}: ${errorText}`);
  }

  if (!response.body) {
    throw new Error("No response body from OpenRouter");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Process complete SSE events (separated by \n\n)
    const events = buffer.split("\n\n");
    buffer = events.pop() || ""; // Keep the incomplete event in the buffer

    for (const event of events) {
      const lines = event.split("\n");
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6).trim();
          if (data === "[DONE]") {
            return;
          }
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              yield { content, done: false };
            }
          } catch {
            // Skip malformed JSON (can happen with partial chunks)
          }
        }
      }
    }
  }

  yield { content: "", done: true };
}

/**
 * Parse the streamed JSON response to extract metadata fields.
 *
 * The LLM streams JSON like: { "content": "...", "type": "...", "claimRef": ..., "mood": "..." }
 * After all tokens are accumulated, this extracts the full JSON.
 *
 * @param fullText The complete text streamed from the LLM
 * @returns Parsed persona response, or null if JSON is malformed
 */
export function parseStreamedPersonaResponse(fullText: string): {
  content: string;
  type: "normal" | "interruption";
  claimRef: number | null;
  mood: string;
} | null {
  let text = fullText.trim();

  // Strip markdown code fences if present
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    text = fenceMatch[1].trim();
  }

  // Find the JSON object
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;

  const jsonStr = text.slice(start, end + 1);

  try {
    const parsed = JSON.parse(jsonStr);
    return {
      content: parsed.content || "",
      type: parsed.type === "interruption" ? "interruption" : "normal",
      claimRef: typeof parsed.claimRef === "number" && parsed.claimRef > 0 ? parsed.claimRef : null,
      mood: parsed.mood || "neutral",
    };
  } catch {
    // Try fixing trailing commas
    try {
      const cleaned = jsonStr.replace(/,\s*([}\]])/g, "$1");
      const parsed = JSON.parse(cleaned);
      return {
        content: parsed.content || "",
        type: parsed.type === "interruption" ? "interruption" : "normal",
        claimRef: typeof parsed.claimRef === "number" && parsed.claimRef > 0 ? parsed.claimRef : null,
        mood: parsed.mood || "neutral",
      };
    } catch {
      return null;
    }
  }
}

/**
 * Extract the "content" value from a partial JSON stream.
 *
 * As the LLM streams tokens, the JSON looks like:
 *   { "content": "Hold on. Drop the qualifier. Say it directly.", "type": ...
 *
 * This function watches for `"content": "` in the stream, then returns
 * everything after it until the closing quote. This lets us start TTS
 * before the full JSON is complete.
 *
 * @param accumulatedText The full text streamed so far
 * @returns The extracted content so far, or null if content hasn't started yet
 */
export function extractPartialContent(accumulatedText: string): string | null {
  // Look for the content field: "content": "..." or "content":"..."
  const contentMatch = accumulatedText.match(/"content"\s*:\s*"(.*)$/s);
  if (!contentMatch) return null;

  // The content is everything after the opening quote
  // until either the closing quote (escaped or not) or end of string
  let content = contentMatch[1];

  // Check if the content field is complete (closing quote found)
  // The closing quote is followed by ", or " at end
  // We need to handle escaped quotes inside the content
  const closingQuoteIdx = findClosingQuote(content);
  if (closingQuoteIdx >= 0) {
    content = content.slice(0, closingQuoteIdx);
  }

  // Unescape JSON string escapes
  content = content
    .replace(/\\n/g, "\n")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\")
    .replace(/\\t/g, "\t");

  return content;
}

/**
 * Find the position of the closing quote in a JSON string value.
 * Handles escaped quotes (\\").
 */
function findClosingQuote(text: string): number {
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\\") {
      i++; // Skip the escaped character
      continue;
    }
    if (text[i] === '"') {
      return i;
    }
  }
  return -1; // No closing quote found yet (still streaming)
}

/**
 * Split text into sentences at natural boundaries.
 * Returns complete sentences + any remaining partial text.
 */
export function splitSentences(text: string): {
  sentences: string[];
  remaining: string;
} {
  const sentences: string[] = [];
  let remaining = text;

  // Match sentences ending with ., ?, or !
  // Also handle the case where the sentence ends with a quote
  const sentenceRegex = /[^.!?]*[.!?]+\s*/g;
  let match;
  let lastIndex = 0;

  while ((match = sentenceRegex.exec(text)) !== null) {
    const sentence = match[0].trim();
    if (sentence.length > 0) {
      sentences.push(sentence);
    }
    lastIndex = sentenceRegex.lastIndex;
  }

  remaining = text.slice(lastIndex);

  return { sentences, remaining };
}
