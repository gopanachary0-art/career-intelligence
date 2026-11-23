import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ingestDocument, listDocuments } from "@/lib/documents";
import { parseUploadedFile } from "@/lib/parse-document";

const workspaceSchema = z.string().uuid();
const docTypeSchema = z.enum(["resume", "job"]);

export async function GET(req: NextRequest) {
  try {
    const workspaceId = req.nextUrl.searchParams.get("workspaceId");
    const parsed = workspaceSchema.safeParse(workspaceId);
    if (!parsed.success) {
      return NextResponse.json({ error: "workspaceId UUID required" }, { status: 400 });
    }
    const docs = await listDocuments(parsed.data);
    return NextResponse.json({ documents: docs });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list documents" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const workspaceId = workspaceSchema.parse(form.get("workspaceId"));
    const docType = docTypeSchema.parse(form.get("docType"));
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }
    if (file.size > 8 * 1024 * 1024) {
      return NextResponse.json({ error: "File must be under 8MB" }, { status: 400 });
    }

    const { text, title } = await parseUploadedFile(file);
    const customTitle = String(form.get("title") || "").trim();
    const result = await ingestDocument({
      workspaceId,
      docType,
      title: customTitle || title,
      filename: file.name,
      content: text,
    });

    return NextResponse.json({
      ok: true,
      documentId: result.documentId,
      chunkCount: result.chunkCount,
      title: customTitle || title,
    });
  } catch (error) {
    console.error("upload failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 },
    );
  }
}
