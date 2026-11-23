import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

const MAX_CHARS = 200_000;

export async function parseUploadedFile(
  file: File,
): Promise<{ text: string; title: string }> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const name = file.name || "document";
  const lower = name.toLowerCase();
  const mime = file.type;

  let text = "";

  if (
    mime === "application/pdf" ||
    lower.endsWith(".pdf")
  ) {
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    text = result.text ?? "";
  } else if (
    mime ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    lower.endsWith(".docx")
  ) {
    const result = await mammoth.extractRawText({ buffer });
    text = result.value ?? "";
  } else if (
    mime.startsWith("text/") ||
    lower.endsWith(".txt") ||
    lower.endsWith(".md")
  ) {
    text = buffer.toString("utf-8");
  } else {
    // Best-effort: treat unknown types as UTF-8 text
    text = buffer.toString("utf-8");
  }

  text = text.replace(/\u0000/g, "").trim();
  if (!text) {
    throw new Error(`Could not extract text from "${name}".`);
  }
  if (text.length > MAX_CHARS) {
    text = text.slice(0, MAX_CHARS);
  }

  const title = name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
  return { text, title: title || "Untitled" };
}
