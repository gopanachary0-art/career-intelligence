"use client";

import type { DocumentSummary } from "@/lib/types";

type Props = {
  workspaceId: string;
  documents: DocumentSummary[];
  onChanged: () => void;
};

export function DocumentList({ workspaceId, documents, onChanged }: Props) {
  async function remove(id: string) {
    const res = await fetch(
      `/api/documents/${id}?workspaceId=${encodeURIComponent(workspaceId)}`,
      { method: "DELETE" },
    );
    if (res.ok) onChanged();
  }

  if (documents.length === 0) {
    return (
      <section className="panel">
        <p className="empty">No documents yet. Upload files or load demo samples.</p>
      </section>
    );
  }

  const resume = documents.filter((d) => d.docType === "resume");
  const jobs = documents.filter((d) => d.docType === "job");
  const jobNumber = new Map(jobs.map((j, i) => [j.id, i + 1]));

  return (
    <section className="panel">
      <header className="panel-head">
        <h2>Library</h2>
        <p>
          {resume.length} resume · {jobs.length} job
          {jobs.length === 1 ? "" : "s"}
        </p>
      </header>
      <ul className="doc-list">
        {documents.map((doc) => (
          <li key={doc.id}>
            <div>
              <span className={`badge badge-${doc.docType}`}>
                {doc.docType === "resume"
                  ? "Resume"
                  : `Job #${jobNumber.get(doc.id)}`}
              </span>
              <strong>{doc.title}</strong>
              <small>
                {doc.chunkCount} chunks · {doc.filename}
              </small>
            </div>
            <button type="button" className="icon-btn" onClick={() => remove(doc.id)}>
              Remove
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
