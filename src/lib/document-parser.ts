// Spar — Multi-format Document Text Extractor (.pdf, .docx, .pptx, .txt, .md)
//
// Extracts clean, readable text from uploaded user documents (resumes, lesson
// plans, research papers, slide decks, strategy memos) using Node/Bun built-in
// zlib decompression with zero external binary or worker dependencies.

import { inflateRawSync, inflateSync } from "node:zlib";

export type SupportedDocumentExtension = "pdf" | "docx" | "pptx" | "txt" | "md";

export interface ParsedDocumentResult {
  fileName: string;
  extension: SupportedDocumentExtension;
  text: string;
  charCount: number;
  wordCount: number;
}

const MAX_EXTRACTED_CHARS = 24_000;

export function detectDocumentExtension(
  fileName: string,
  mimeType?: string | null
): SupportedDocumentExtension | null {
  const lower = fileName.toLowerCase().trim();
  if (lower.endsWith(".pdf") || mimeType === "application/pdf") return "pdf";
  if (
    lower.endsWith(".docx") ||
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return "docx";
  }
  if (
    lower.endsWith(".pptx") ||
    mimeType ===
      "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  ) {
    return "pptx";
  }
  if (lower.endsWith(".md") || lower.endsWith(".markdown")) return "md";
  if (lower.endsWith(".txt") || mimeType?.startsWith("text/")) return "txt";
  return null;
}

/**
 * Extract clean text from a document buffer based on its filename/MIME type.
 */
export async function parseDocumentBuffer(
  buffer: Uint8Array | ArrayBuffer,
  fileName: string,
  mimeType?: string | null
): Promise<ParsedDocumentResult> {
  const ext = detectDocumentExtension(fileName, mimeType);
  if (!ext) {
    throw new Error(
      "Unsupported file format. Please upload a PDF, DOCX, PPTX, TXT, or Markdown file."
    );
  }

  const bytes =
    buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);

  let rawText = "";
  if (ext === "txt" || ext === "md") {
    rawText = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  } else if (ext === "docx") {
    rawText = extractDocxText(bytes);
  } else if (ext === "pptx") {
    rawText = extractPptxText(bytes);
  } else if (ext === "pdf") {
    rawText = extractPdfText(bytes);
  }

  const cleaned = normalizeExtractedText(rawText).slice(0, MAX_EXTRACTED_CHARS);
  const words = cleaned ? cleaned.split(/\s+/).filter(Boolean) : [];

  if (cleaned.length < 10) {
    throw new Error(
      `Could not extract enough readable text from "${fileName}". If this is a scanned image PDF, please paste the text directly.`
    );
  }

  return {
    fileName,
    extension: ext,
    text: cleaned,
    charCount: cleaned.length,
    wordCount: words.length,
  };
}

function normalizeExtractedText(input: string): string {
  return input
    .replace(/\r\n/g, "\n")
    .replace(/\u0000/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ─── ZIP / OpenXML (.docx & .pptx) Extractor ────────────────────────────

interface ZipEntry {
  name: string;
  data: Uint8Array;
}

function readZipEntries(bytes: Uint8Array): ZipEntry[] {
  const entries: ZipEntry[] = [];
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 0;

  while (offset + 30 <= bytes.length) {
    const signature = view.getUint32(offset, true);
    if (signature !== 0x04034b50) {
      offset++;
      continue;
    }

    const compressionMethod = view.getUint16(offset + 8, true);
    const compressedSize = view.getUint32(offset + 18, true);
    const fileNameLength = view.getUint16(offset + 26, true);
    const extraFieldLength = view.getUint16(offset + 28, true);

    const nameStart = offset + 30;
    const nameEnd = nameStart + fileNameLength;
    if (nameEnd > bytes.length) break;

    const name = new TextDecoder("utf-8").decode(
      bytes.subarray(nameStart, nameEnd)
    );
    const dataStart = nameEnd + extraFieldLength;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > bytes.length) break;

    const compressed = bytes.subarray(dataStart, dataEnd);
    try {
      if (compressionMethod === 0) {
        entries.push({ name, data: compressed });
      } else if (compressionMethod === 8) {
        const inflated = inflateRawSync(compressed);
        entries.push({ name, data: new Uint8Array(inflated) });
      }
    } catch {
      // Skip malformed entry
    }

    offset = dataEnd > offset ? dataEnd : offset + 30;
  }

  return entries;
}

function decodeXmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function extractDocxText(bytes: Uint8Array): string {
  const entries = readZipEntries(bytes);
  const docEntry = entries.find((e) => e.name === "word/document.xml");
  if (!docEntry) {
    // Fallback: if plain text was saved with .docx extension
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  }

  const xml = new TextDecoder("utf-8").decode(docEntry.data);
  const paragraphs = xml.split(/<\/w:p>/i);
  const lines: string[] = [];

  for (const p of paragraphs) {
    const matches = p.matchAll(/<w:t(?:\s+[^>]*)?>([\s\S]*?)<\/w:t>/gi);
    let line = "";
    for (const m of matches) {
      line += decodeXmlEntities(m[1]);
    }
    if (line.trim()) {
      lines.push(line.trim());
    }
  }

  return lines.join("\n");
}

function extractPptxText(bytes: Uint8Array): string {
  const entries = readZipEntries(bytes)
    .filter((e) => /^ppt\/slides\/slide\d+\.xml$/i.test(e.name))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

  if (entries.length === 0) {
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  }

  const slidesText: string[] = [];
  entries.forEach((entry, idx) => {
    const xml = new TextDecoder("utf-8").decode(entry.data);
    const paragraphs = xml.split(/<\/a:p>/i);
    const lines: string[] = [];
    for (const p of paragraphs) {
      const matches = p.matchAll(/<a:t(?:\s+[^>]*)?>([\s\S]*?)<\/a:t>/gi);
      let line = "";
      for (const m of matches) {
        line += decodeXmlEntities(m[1]);
      }
      if (line.trim()) lines.push(line.trim());
    }
    if (lines.length > 0) {
      slidesText.push(`Slide ${idx + 1}: ${lines.join(" — ")}`);
    }
  });

  return slidesText.join("\n");
}

// ─── PDF Text Extractor ─────────────────────────────────────────────────

function decodePdfLiteralString(raw: string): string {
  let out = "";
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === "\\") {
      const next = raw[++i];
      if (!next) break;
      if (next === "n") out += "\n";
      else if (next === "r") out += "\r";
      else if (next === "t") out += "\t";
      else if (next >= "0" && next <= "7") {
        let oct = next;
        if (raw[i + 1] >= "0" && raw[i + 1] <= "7") oct += raw[++i];
        if (raw[i + 1] >= "0" && raw[i + 1] <= "7") oct += raw[++i];
        out += String.fromCharCode(parseInt(oct, 8));
      } else {
        out += next;
      }
    } else {
      out += ch;
    }
  }
  return out;
}

function extractTextFromPdfOperators(content: string): string {
  const chunks: string[] = [];

  // Extract BT ... ET text blocks if present, otherwise scan whole stream
  const blocks = content.includes("BT")
    ? Array.from(content.matchAll(/BT([\s\S]*?)ET/g)).map((m) => m[1])
    : [content];

  for (const block of blocks) {
    const lineParts: string[] = [];
    // Match TJ arrays: [(Hello) -20 (world)] TJ
    const tokenRegex = /\[([\s\S]*?)\]\s*TJ|\((?:\\.|[^\\()])*\)\s*(?:Tj|'|")/g;
    let match: RegExpExecArray | null;
    while ((match = tokenRegex.exec(block)) !== null) {
      if (match[1] !== undefined) {
        // TJ array
        const inner = match[1];
        const strMatches = inner.matchAll(/\(((?:\\.|[^\\()])*)\)/g);
        let combined = "";
        for (const sm of strMatches) {
          combined += decodePdfLiteralString(sm[1]);
        }
        if (combined) lineParts.push(combined);
      } else {
        // Single (string) Tj
        const innerMatch = match[0].match(/^\(((?:\\.|[^\\()])*)\)/);
        if (innerMatch) {
          lineParts.push(decodePdfLiteralString(innerMatch[1]));
        }
      }
    }
    if (lineParts.length > 0) {
      chunks.push(lineParts.join(" "));
    }
  }

  return chunks.join("\n");
}

function extractPdfText(bytes: Uint8Array): string {
  const latin1 = new TextDecoder("latin1").decode(bytes);
  const extractedSections: string[] = [];

  // Scan all stream ... endstream blocks
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match: RegExpExecArray | null;

  while ((match = streamRegex.exec(latin1)) !== null) {
    const streamStart = match.index + match[0].indexOf("\n") + 1;
    const streamLength = match[1].length;
    const rawSlice = bytes.subarray(streamStart, streamStart + streamLength);

    let decodedContent = "";
    try {
      const inflated = inflateSync(rawSlice);
      decodedContent = new TextDecoder("latin1").decode(inflated);
    } catch {
      try {
        const inflatedRaw = inflateRawSync(rawSlice);
        decodedContent = new TextDecoder("latin1").decode(inflatedRaw);
      } catch {
        decodedContent = match[1];
      }
    }

    const text = extractTextFromPdfOperators(decodedContent);
    if (text.trim()) {
      extractedSections.push(text.trim());
    }
  }

  if (extractedSections.length > 0) {
    return extractedSections.join("\n");
  }

  // Fallback for uncompressed PDFs with direct text operators
  const direct = extractTextFromPdfOperators(latin1);
  if (direct.trim().length >= 10) {
    return direct.trim();
  }

  return "";
}
