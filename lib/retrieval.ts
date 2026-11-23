import { sql } from "@/db";
import type { DocType, RetrievedChunk } from "./types";
import { embedQuery } from "./embeddings";

export type RetrieveOptions = {
  workspaceId: string;
  query: string;
  topK?: number;
  docTypes?: DocType[];
  minScore?: number;
};

/**
 * Hybrid-ish retrieval for a small corpus:
 * 1) Embed the question
 * 2) Cosine similarity over pgvector
 * 3) Soft boost when the query references a specific job ("Job #2", title match)
 *
 * For production we'd add BM25 / RRF hybrid search and a cross-encoder reranker.
 */
export async function retrieveChunks(
  options: RetrieveOptions,
): Promise<RetrievedChunk[]> {
  const topK = options.topK ?? 8;
  const minScore = options.minScore ?? 0.25;
  const embedding = await embedQuery(options.query);
  const vectorLiteral = `[${embedding.join(",")}]`;
  const limit = topK * 2;

  let rows: Array<{
    id: string;
    document_id: string;
    content: string;
    section: string | null;
    document_title: string;
    doc_type: DocType;
    score: number;
  }>;

  if (options.docTypes && options.docTypes.length > 0) {
    rows = await sql`
      SELECT
        c.id,
        c.document_id,
        c.content,
        c.section,
        d.title AS document_title,
        d.doc_type,
        1 - (c.embedding <=> ${vectorLiteral}::vector) AS score
      FROM chunks c
      JOIN documents d ON d.id = c.document_id
      WHERE c.workspace_id = ${options.workspaceId}::uuid
        AND d.doc_type = ANY(${options.docTypes})
      ORDER BY c.embedding <=> ${vectorLiteral}::vector
      LIMIT ${limit}
    `;
  } else {
    rows = await sql`
      SELECT
        c.id,
        c.document_id,
        c.content,
        c.section,
        d.title AS document_title,
        d.doc_type,
        1 - (c.embedding <=> ${vectorLiteral}::vector) AS score
      FROM chunks c
      JOIN documents d ON d.id = c.document_id
      WHERE c.workspace_id = ${options.workspaceId}::uuid
      ORDER BY c.embedding <=> ${vectorLiteral}::vector
      LIMIT ${limit}
    `;
  }

  const queryLower = options.query.toLowerCase();
  const ranked = rows.map((row) => {
    let score = Number(row.score);
    const titleLower = row.document_title.toLowerCase();

    if (
      /\bjob\s*#?\s*2\b|\bsecond job\b/i.test(options.query) &&
      /2|second/i.test(row.document_title)
    ) {
      score += 0.08;
    }
    if (
      /\bjob\s*#?\s*1\b|\bfirst job\b/i.test(options.query) &&
      /1|first/i.test(row.document_title)
    ) {
      score += 0.08;
    }
    if (
      titleLower
        .split(/\s+/)
        .some((token) => token.length > 3 && queryLower.includes(token))
    ) {
      score += 0.03;
    }
    if (
      row.doc_type === "resume" &&
      /\b(my|i|resume|experience|skill)\b/i.test(options.query)
    ) {
      score += 0.02;
    }

    return {
      id: row.id,
      documentId: row.document_id,
      documentTitle: row.document_title,
      docType: row.doc_type,
      content: row.content,
      section: row.section,
      score,
    } satisfies RetrievedChunk;
  });

  return ranked
    .filter((c) => c.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

export function formatContext(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) return "(No relevant document excerpts found.)";

  return chunks
    .map((chunk, i) => {
      const label = chunk.docType === "resume" ? "RESUME" : "JOB";
      const section = chunk.section ? ` | section: ${chunk.section}` : "";
      return [
        `[${i + 1}] (${label}: ${chunk.documentTitle}${section} | relevance: ${chunk.score.toFixed(3)})`,
        chunk.content,
      ].join("\n");
    })
    .join("\n\n---\n\n");
}
