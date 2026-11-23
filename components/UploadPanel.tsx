"use client";

import { useRef, useState } from "react";
import type { DocType } from "@/lib/types";

type Props = {
  workspaceId: string;
  onUploaded: () => void;
};

export function UploadPanel({ workspaceId, onUploaded }: Props) {
  const [docType, setDocType] = useState<DocType>("resume");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File | null) {
    if (!file) return;
    setBusy(true);
    setError(null);
    setHint(null);
    try {
      const form = new FormData();
      form.set("workspaceId", workspaceId);
      form.set("docType", docType);
      form.set("file", file);
      if (title.trim()) form.set("title", title.trim());

      const res = await fetch("/api/documents", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");

      setHint(`Indexed “${data.title}” into ${data.chunkCount} chunks.`);
      setTitle("");
      if (inputRef.current) inputRef.current.value = "";
      onUploaded();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function loadSamples() {
    setBusy(true);
    setError(null);
    setHint(null);
    try {
      const res = await fetch("/api/seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Seed failed");
      setHint(`Loaded ${data.seeded} sample documents.`);
      onUploaded();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Seed failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel">
      <header className="panel-head">
        <h2>Documents</h2>
        <p>Upload a resume and one or more job postings (.pdf, .docx, .txt).</p>
      </header>

      <div className="seg">
        <button
          type="button"
          className={docType === "resume" ? "seg-active" : ""}
          onClick={() => setDocType("resume")}
        >
          Resume
        </button>
        <button
          type="button"
          className={docType === "job" ? "seg-active" : ""}
          onClick={() => setDocType("job")}
        >
          Job posting
        </button>
      </div>

      <label className="field">
        <span>Title (optional)</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={
            docType === "resume" ? "My resume" : "Job #2 — Platform Engineer"
          }
        />
      </label>

      <label className="drop">
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx,.txt,.md,text/plain,application/pdf"
          disabled={busy}
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />
        <span className="drop-title">
          {busy ? "Indexing…" : "Drop a file or click to browse"}
        </span>
        <span className="drop-sub">Max 8MB · text is chunked & embedded on upload</span>
      </label>

      <button
        type="button"
        className="ghost-btn"
        onClick={loadSamples}
        disabled={busy}
      >
        Load demo samples
      </button>

      {hint && <p className="ok-msg">{hint}</p>}
      {error && <p className="err-msg">{error}</p>}
    </section>
  );
}
