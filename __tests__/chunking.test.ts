import { describe, expect, it } from "vitest";
import { chunkDocument } from "@/lib/chunking";

describe("chunkDocument", () => {
  it("splits resume sections and preserves section labels", () => {
    const text = `
SUMMARY
Experienced engineer.

SKILLS
TypeScript, React, PostgreSQL.

EXPERIENCE
Built APIs and UIs.
`.trim();

    const chunks = chunkDocument(text, { maxChars: 400, overlap: 0 });
    expect(chunks.length).toBeGreaterThanOrEqual(3);
    expect(chunks.some((c) => c.section?.toLowerCase().includes("skills"))).toBe(
      true,
    );
    expect(chunks.some((c) => /TypeScript/.test(c.content))).toBe(true);
  });

  it("returns empty array for blank input", () => {
    expect(chunkDocument("   ")).toEqual([]);
  });

  it("splits long unstructured text without dropping content", () => {
    const paragraph = "Sentence one. ".repeat(80);
    const chunks = chunkDocument(paragraph, { maxChars: 200, overlap: 40 });
    expect(chunks.length).toBeGreaterThan(1);
    const joined = chunks.map((c) => c.content).join(" ");
    expect(joined.includes("Sentence one.")).toBe(true);
  });
});
