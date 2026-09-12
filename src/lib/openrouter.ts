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
const MODEL = "openai/gpt-oss-20b"; // Faster + cheaper than minimax-m3

export interface StreamedToken {
  content: string;
  done: boolean;
}

/**
 * Stream a persona response from OpenRouter.
 * Yields individual text tokens as they arrive.
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
      max_tokens: 150,
      temperature: 0.5,
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

    const events = buffer.split("\n\n");
    buffer = events.pop() || "";

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
            // Skip malformed JSON
          }
        }
      }
    }
  }

  yield { content: "", done: true };
}

/**
 * Parse the streamed JSON response to extract metadata fields.
 */
export function parseStreamedPersonaResponse(fullText: string): {
  content: string;
  type: "normal" | "interruption";
  claimRef: number | null;
  mood: string;
} | null {
  let text = fullText.trim();

  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    text = fenceMatch[1].trim();
  }

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
 * This function finds the "content" field and returns everything between
 * the opening and closing quote (or end of string if still streaming).
 * Handles escaped quotes properly.
 */
export function extractPartialContent(accumulatedText: string): string | null {
  // Find the "content" field
  const contentStart = accumulatedText.indexOf('"content"');
  if (contentStart === -1) return null;

  // Find the colon after "content"
  const colonPos = accumulatedText.indexOf(":", contentStart);
  if (colonPos === -1) return null;

  // Skip whitespace after colon to find the opening quote
  let pos = colonPos + 1;
  while (
    pos < accumulatedText.length &&
    (accumulatedText[pos] === " " ||
      accumulatedText[pos] === "\n" ||
      accumulatedText[pos] === "\r")
  ) {
    pos++;
  }

  if (pos >= accumulatedText.length || accumulatedText[pos] !== '"') return null;

  // Start of content is after the opening quote
  pos++;

  // Accumulate content until we find an unescaped closing quote
  let content = "";
  while (pos < accumulatedText.length) {
    if (accumulatedText[pos] === "\\") {
      // Escaped character
      pos++;
      if (pos < accumulatedText.length) {
        const escaped = accumulatedText[pos];
        if (escaped === "n") content += "\n";
        else if (escaped === "t") content += "\t";
        else if (escaped === '"') content += '"';
        else if (escaped === "\\") content += "\\";
        else content += escaped;
      }
      pos++;
    } else if (accumulatedText[pos] === '"') {
      // Found closing quote — content is complete
      return content;
    } else {
      content += accumulatedText[pos];
      pos++;
    }
  }

  // No closing quote yet — return partial content (still streaming)
  return content;
}

/**
 * Split text into sentences at natural boundaries.
 */
export function splitSentences(text: string): {
  sentences: string[];
  remaining: string;
} {
  const sentences: string[] = [];
  let remaining = text;

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
