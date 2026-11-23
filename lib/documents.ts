import { and, count, desc, eq, sql as dsql } from "drizzle-orm";
import { db } from "@/db";
import { chunks, documents, workspaces } from "@/db/schema";
import { chunkDocument } from "./chunking";
import { embedTexts } from "./embeddings";
import type { DocType, DocumentSummary } from "./types";

export async function ensureWorkspace(workspaceId: string): Promise<void> {
  await db
    .insert(workspaces)
    .values({ id: workspaceId })
    .onConflictDoNothing();
}

export async function listDocuments(
  workspaceId: string,
): Promise<DocumentSummary[]> {
  const rows = await db
    .select({
      id: documents.id,
      docType: documents.docType,
      title: documents.title,
      filename: documents.filename,
      createdAt: documents.createdAt,
      chunkCount: count(chunks.id),
    })
    .from(documents)
    .leftJoin(chunks, eq(chunks.documentId, documents.id))
    .where(eq(documents.workspaceId, workspaceId))
    .groupBy(
      documents.id,
      documents.docType,
      documents.title,
      documents.filename,
      documents.createdAt,
    )
    .orderBy(desc(documents.createdAt));

  return rows.map((r) => ({
    id: r.id,
    docType: r.docType as DocType,
    title: r.title,
    filename: r.filename,
    createdAt: r.createdAt.toISOString(),
    chunkCount: Number(r.chunkCount),
  }));
}

export async function ingestDocument(args: {
  workspaceId: string;
  docType: DocType;
  title: string;
  filename: string;
  content: string;
}): Promise<{ documentId: string; chunkCount: number }> {
  await ensureWorkspace(args.workspaceId);

  // Only one resume per workspace for clearer UX in this demo
  if (args.docType === "resume") {
    const existing = await db
      .select({ id: documents.id })
      .from(documents)
      .where(
        and(
          eq(documents.workspaceId, args.workspaceId),
          eq(documents.docType, "resume"),
        ),
      );
    for (const row of existing) {
      await db.delete(documents).where(eq(documents.id, row.id));
    }
  }

  const documentId = crypto.randomUUID();
  const textChunks = chunkDocument(args.content);
  if (textChunks.length === 0) {
    throw new Error("Document produced no chunks after parsing.");
  }

  const embeddings = await embedTexts(textChunks.map((c) => c.content));

  await db.insert(documents).values({
    id: documentId,
    workspaceId: args.workspaceId,
    docType: args.docType,
    title: args.title,
    filename: args.filename,
    content: args.content,
  });

  // Batch insert chunks with embeddings via raw SQL for vector casting
  for (let i = 0; i < textChunks.length; i++) {
    const chunk = textChunks[i];
    const embedding = embeddings[i];
    const vectorLiteral = `[${embedding.join(",")}]`;
    await db.execute(dsql`
      INSERT INTO chunks (id, document_id, workspace_id, content, chunk_index, section, embedding)
      VALUES (
        ${crypto.randomUUID()}::uuid,
        ${documentId}::uuid,
        ${args.workspaceId}::uuid,
        ${chunk.content},
        ${chunk.chunkIndex},
        ${chunk.section},
        ${vectorLiteral}::vector
      )
    `);
  }

  return { documentId, chunkCount: textChunks.length };
}

export async function deleteDocument(
  workspaceId: string,
  documentId: string,
): Promise<boolean> {
  const deleted = await db
    .delete(documents)
    .where(
      and(eq(documents.id, documentId), eq(documents.workspaceId, workspaceId)),
    )
    .returning({ id: documents.id });
  return deleted.length > 0;
}
