import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { answerQuestion, listMessages } from "@/lib/chat";
import { ensureWorkspace } from "@/lib/documents";

const bodySchema = z.object({
  workspaceId: z.string().uuid(),
  question: z.string().min(1).max(2000),
});

export async function GET(req: NextRequest) {
  try {
    const workspaceId = z
      .string()
      .uuid()
      .parse(req.nextUrl.searchParams.get("workspaceId"));
    await ensureWorkspace(workspaceId);
    const messages = await listMessages(workspaceId);
    return NextResponse.json({ messages });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load messages" },
      { status: 400 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const { workspaceId, question } = bodySchema.parse(json);
    await ensureWorkspace(workspaceId);
    const result = await answerQuestion(workspaceId, question);
    return NextResponse.json(result);
  } catch (error) {
    console.error("chat failed", error);
    const message = error instanceof Error ? error.message : "Chat failed";
    const status = message.includes("OPENAI_API_KEY") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
