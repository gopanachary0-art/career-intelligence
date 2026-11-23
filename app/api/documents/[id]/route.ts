import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { deleteDocument } from "@/lib/documents";

const uuid = z.string().uuid();

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const documentId = uuid.parse(id);
    const workspaceId = uuid.parse(req.nextUrl.searchParams.get("workspaceId"));
    const ok = await deleteDocument(workspaceId, documentId);
    if (!ok) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Delete failed" },
      { status: 400 },
    );
  }
}
