import { describe, expect, test } from "bun:test";
import { deflateRawSync, deflateSync } from "node:zlib";
import { detectDocumentExtension, parseDocumentBuffer } from "./document-parser";

function createMockZip(entryName: string, xmlContent: string): Uint8Array {
  const nameBytes = new TextEncoder().encode(entryName);
  const rawData = new TextEncoder().encode(xmlContent);
  const compressed = new Uint8Array(deflateRawSync(rawData));

  const header = new Uint8Array(30 + nameBytes.length + compressed.length);
  const view = new DataView(header.buffer);
  view.setUint32(0, 0x04034b50, true); // PK\x03\x04
  view.setUint16(8, 8, true); // Deflate compression
  view.setUint32(18, compressed.length, true);
  view.setUint32(22, rawData.length, true);
  view.setUint16(26, nameBytes.length, true);
  view.setUint16(28, 0, true);

  header.set(nameBytes, 30);
  header.set(compressed, 30 + nameBytes.length);
  return header;
}

describe("document-parser", () => {
  test("detects supported extensions accurately", () => {
    expect(detectDocumentExtension("resume.pdf")).toBe("pdf");
    expect(detectDocumentExtension("syllabus.DOCX")).toBe("docx");
    expect(detectDocumentExtension("deck.pptx")).toBe("pptx");
    expect(detectDocumentExtension("notes.md")).toBe("md");
    expect(detectDocumentExtension("memo.txt")).toBe("txt");
    expect(detectDocumentExtension("image.png")).toBeNull();
  });

  test("extracts text from .docx zip buffers", async () => {
    const xml = `<w:document><w:body><w:p><w:r><w:t>Senior Software Engineer — Led distributed cache migration</w:t></w:r></w:p><w:p><w:r><w:t>Reduced p99 latency by 42% across 12 services.</w:t></w:r></w:p></w:body></w:document>`;
    const zipBytes = createMockZip("word/document.xml", xml);

    const parsed = await parseDocumentBuffer(zipBytes, "Candidate_Resume.docx");
    expect(parsed.extension).toBe("docx");
    expect(parsed.text).toContain("Senior Software Engineer");
    expect(parsed.text).toContain("Reduced p99 latency by 42%");
  });

  test("extracts text from FlateDecode .pdf buffers", async () => {
    const pdfStreamContent = `BT /F1 12 Tf (Teaching Chemical Distillation to Undergraduate Engineers) Tj [(Tray efficiency ) -10 (calculations and reflux ratios.)] TJ ET`;
    const compressed = new Uint8Array(deflateSync(Buffer.from(pdfStreamContent, "latin1")));

    const prefix = Buffer.from("%PDF-1.4\n1 0 obj\n<< /Filter /FlateDecode >>\nstream\n", "latin1");
    const suffix = Buffer.from("\nendstream\nendobj\n%%EOF", "latin1");
    const pdfBytes = Buffer.concat([prefix, Buffer.from(compressed), suffix]);

    const parsed = await parseDocumentBuffer(pdfBytes, "Distillation_Lecture.pdf");
    expect(parsed.extension).toBe("pdf");
    expect(parsed.text).toContain("Teaching Chemical Distillation to Undergraduate Engineers");
    expect(parsed.text).toContain("Tray efficiency calculations and reflux ratios.");
  });
});
