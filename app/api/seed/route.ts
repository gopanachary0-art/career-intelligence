import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { z } from "zod";
import { ingestDocument, listDocuments } from "@/lib/documents";

/**
 * Loads sample resume + 3 job postings for a quick demo.
 * POST { workspaceId }
 */
export async function POST(req: NextRequest) {
  try {
    const { workspaceId } = z
      .object({ workspaceId: z.string().uuid() })
      .parse(await req.json());

    const samplesDir = path.join(process.cwd(), "samples");
    const files: Array<{ file: string; docType: "resume" | "job"; title: string }> = [
      { file: "resume.txt", docType: "resume", title: "Alex Rivera — Resume" },
      {
        file: "job-senior-fullstack.txt",
        docType: "job",
        title: "Job #1 — Senior Full Stack Engineer",
      },
      {
        file: "job-platform-engineer.txt",
        docType: "job",
        title: "Job #2 — Platform Engineer",
      },
      {
        file: "job-ml-engineer.txt",
        docType: "job",
        title: "Job #3 — ML Engineer",
      },
    ];

    const results = [];
    for (const sample of files) {
      const content = await readFile(path.join(samplesDir, sample.file), "utf-8");
      const ingested = await ingestDocument({
        workspaceId,
        docType: sample.docType,
        title: sample.title,
        filename: sample.file,
        content,
      });
      results.push({ ...sample, ...ingested });
    }

    const documents = await listDocuments(workspaceId);
    return NextResponse.json({ ok: true, seeded: results.length, documents });
  } catch (error) {
    console.error("seed failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Seed failed" },
      { status: 500 },
    );
  }
}
