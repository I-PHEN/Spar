// Spar — Universal Document Ingestion & Pre-Flight Vulnerability Scanner API
//
// Accepts PDF, DOCX, PPTX, TXT, or Markdown uploads (via multipart/form-data or JSON),
// extracts clean text, classifies the subject domain, and returns 3-5 core
// claims + 3 specific "Attack Hotspots" for the Practice setup screen.

import { NextRequest, NextResponse } from "next/server";
import { parseDocumentBuffer } from "@/lib/document-parser";
import { analyzeDocumentMaterial } from "@/lib/llm";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";
    let fileName = "document.txt";
    let mimeType: string | null = null;
    let buffer: Uint8Array | null = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file");
      if (!file || typeof file === "string") {
        return NextResponse.json(
          { error: "No document file provided" },
          { status: 400 }
        );
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        return NextResponse.json(
          { error: "File exceeds the 10 MB maximum size limit" },
          { status: 400 }
        );
      }
      fileName = file.name || "document.txt";
      mimeType = file.type || null;
      buffer = new Uint8Array(await file.arrayBuffer());
    } else {
      const body = (await req.json().catch(() => ({}))) as {
        fileName?: string;
        mimeType?: string;
        contentBase64?: string;
        rawText?: string;
      };
      fileName = body.fileName?.trim() || "document.txt";
      mimeType = body.mimeType || null;

      if (typeof body.contentBase64 === "string" && body.contentBase64.length > 0) {
        buffer = new Uint8Array(Buffer.from(body.contentBase64, "base64"));
      } else if (typeof body.rawText === "string" && body.rawText.trim().length > 0) {
        buffer = new TextEncoder().encode(body.rawText);
        if (!/\.(pdf|docx|pptx|txt|md|markdown)$/i.test(fileName)) {
          fileName = `${fileName}.txt`;
        }
      } else {
        return NextResponse.json(
          { error: "Provide a document file or text content to analyze" },
          { status: 400 }
        );
      }
    }

    const parsed = await parseDocumentBuffer(buffer, fileName, mimeType);
    const analysis = await analyzeDocumentMaterial(parsed.text, parsed.fileName);

    return NextResponse.json({
      fileName: parsed.fileName,
      extension: parsed.extension,
      rawText: parsed.text,
      charCount: parsed.charCount,
      wordCount: parsed.wordCount,
      detectedDomain: analysis.detectedDomain,
      claims: analysis.claims,
      attackHotspots: analysis.attackHotspots,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to parse document";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
