import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { messages } from "@/db/schema";
import { listDocuments } from "./documents";
import { preflightGuardrails, sanitizeModelOutput } from "./guardrails";
import { chatModel, getOpenAI } from "./openai";
import { SYSTEM_PROMPT, buildUserPrompt } from "./prompts";
import { formatContext, retrieveChunks } from "./retrieval";
import type { ChatResponse, Citation } from "./types";

export async function answerQuestion(
  workspaceId: string,
  question: string,
): Promise<ChatResponse> {
  const catalog = await listDocuments(workspaceId);
  const guard = preflightGuardrails(question, catalog);
  if (!guard.ok) {
    return { answer: guard.message, citations: [], guardrail: guard.message };
  }

  const retrieved = await retrieveChunks({
    workspaceId,
    query: question,
    topK: 8,
  });

  const context = formatContext(retrieved);
  const openai = getOpenAI();

  const completion = await openai.chat.completions.create({
    model: chatModel(),
    temperature: 0.2,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: buildUserPrompt({ question, context, catalog }),
      },
    ],
  });

  const answer = sanitizeModelOutput(
    completion.choices[0]?.message?.content ??
      "I couldn't generate an answer. Try rephrasing.",
  );

  const citations: Citation[] = retrieved.slice(0, 5).map((c) => ({
    documentId: c.documentId,
    documentTitle: c.documentTitle,
    docType: c.docType,
    section: c.section,
    excerpt: c.content.slice(0, 220) + (c.content.length > 220 ? "…" : ""),
    score: Number(c.score.toFixed(3)),
  }));

  await db.insert(messages).values([
    {
      id: crypto.randomUUID(),
      workspaceId,
      role: "user",
      content: question,
    },
    {
      id: crypto.randomUUID(),
      workspaceId,
      role: "assistant",
      content: answer,
      citations,
    },
  ]);

  return { answer, citations, guardrail: null };
}

export async function listMessages(workspaceId: string) {
  const rows = await db
    .select()
    .from(messages)
    .where(eq(messages.workspaceId, workspaceId))
    .orderBy(desc(messages.createdAt))
    .limit(50);

  return rows.reverse().map((m) => ({
    id: m.id,
    role: m.role as "user" | "assistant" | "system",
    content: m.content,
    citations: m.citations,
    createdAt: m.createdAt.toISOString(),
  }));
}
