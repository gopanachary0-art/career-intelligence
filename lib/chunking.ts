export type TextChunk = {
  content: string;
  chunkIndex: number;
  section: string | null;
};

const RESUME_SECTION_HEADERS =
  /^(summary|professional summary|profile|objective|experience|work experience|employment|education|skills|technical skills|projects|certifications|awards|publications|languages)\b[:\s-]*$/i;

const JOB_SECTION_HEADERS =
  /^(about (the )?role|responsibilities|requirements|qualifications|nice to have|preferred|benefits|about (the )?company|what you.?ll do|what we.?re looking for)\b[:\s-]*$/i;

/**
 * Section-aware chunking for resumes and job postings.
 * Prefer splitting on known headings so retrieval returns coherent blocks
 * (e.g. "Skills" stays together) instead of arbitrary mid-sentence cuts.
 */
export function chunkDocument(
  text: string,
  options: { maxChars?: number; overlap?: number } = {},
): TextChunk[] {
  const maxChars = options.maxChars ?? 900;
  const overlap = options.overlap ?? 120;
  const normalized = text.replace(/\r\n/g, "\n").trim();

  if (!normalized) return [];

  const sections = splitIntoSections(normalized);
  const chunks: TextChunk[] = [];

  for (const section of sections) {
    const pieces = splitLongSection(section.body, maxChars, overlap);
    for (const piece of pieces) {
      const labeled =
        section.title && !piece.startsWith(section.title)
          ? `${section.title}\n${piece}`
          : piece;
      chunks.push({
        content: labeled.trim(),
        chunkIndex: chunks.length,
        section: section.title,
      });
    }
  }

  return chunks;
}

function splitIntoSections(text: string): { title: string | null; body: string }[] {
  const lines = text.split("\n");
  const sections: { title: string | null; body: string }[] = [];
  let currentTitle: string | null = null;
  let buffer: string[] = [];

  const flush = () => {
    const body = buffer.join("\n").trim();
    if (body) sections.push({ title: currentTitle, body });
    buffer = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (isSectionHeader(trimmed)) {
      flush();
      currentTitle = trimmed.replace(/:$/, "");
      continue;
    }
    buffer.push(line);
  }
  flush();

  return sections.length > 0 ? sections : [{ title: null, body: text }];
}

function isSectionHeader(line: string): boolean {
  if (!line || line.length > 60) return false;
  if (RESUME_SECTION_HEADERS.test(line) || JOB_SECTION_HEADERS.test(line)) {
    return true;
  }
  // ALL-CAPS short lines often mark resume sections
  return /^[A-Z][A-Z0-9 &/.-]{2,40}$/.test(line) && !line.includes(".");
}

function splitLongSection(text: string, maxChars: number, overlap: number): string[] {
  if (text.length <= maxChars) return [text];

  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const pieces: string[] = [];
  let current = "";

  const pushCurrent = () => {
    if (current.trim()) pieces.push(current.trim());
    current = "";
  };

  for (const para of paragraphs) {
    if (para.length > maxChars) {
      pushCurrent();
      pieces.push(...splitBySentences(para, maxChars, overlap));
      continue;
    }
    if ((current + "\n\n" + para).length > maxChars) {
      pushCurrent();
      current = para;
    } else {
      current = current ? `${current}\n\n${para}` : para;
    }
  }
  pushCurrent();

  // Apply overlap between adjacent pieces for continuity
  if (pieces.length <= 1 || overlap <= 0) return pieces;

  return pieces.map((piece, i) => {
    if (i === 0) return piece;
    const prev = pieces[i - 1];
    const tail = prev.slice(Math.max(0, prev.length - overlap));
    return `${tail}\n${piece}`.trim();
  });
}

function splitBySentences(text: string, maxChars: number, overlap: number): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [text];
  const pieces: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    const next = current ? `${current} ${sentence.trim()}` : sentence.trim();
    if (next.length > maxChars && current) {
      pieces.push(current.trim());
      const tail = current.slice(Math.max(0, current.length - overlap));
      current = `${tail} ${sentence.trim()}`.trim();
    } else {
      current = next;
    }
  }
  if (current.trim()) pieces.push(current.trim());
  return pieces;
}
