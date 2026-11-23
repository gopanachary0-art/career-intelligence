"use client";

import { useCallback, useEffect, useState } from "react";
import { ChatPanel } from "./ChatPanel";
import { DocumentList } from "./DocumentList";
import { UploadPanel } from "./UploadPanel";
import { getOrCreateWorkspaceId } from "@/lib/workspace";
import type { DocumentSummary } from "@/lib/types";

export function AppShell() {
  const [workspaceId, setWorkspaceId] = useState("");
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const refreshDocs = useCallback(async (id: string) => {
    const res = await fetch(
      `/api/documents?workspaceId=${encodeURIComponent(id)}`,
    );
    if (!res.ok) return;
    const data = await res.json();
    setDocuments(data.documents || []);
  }, []);

  useEffect(() => {
    const id = getOrCreateWorkspaceId();
    setWorkspaceId(id);
    void refreshDocs(id);
  }, [refreshDocs]);

  function onUploaded() {
    if (!workspaceId) return;
    void refreshDocs(workspaceId);
    setRefreshKey((k) => k + 1);
  }

  if (!workspaceId) {
    return <div className="boot">Starting Fitcraft…</div>;
  }

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden />
          <div>
            <p className="brand">Fitcraft</p>
            <p className="tagline">Career intelligence from your resume & jobs</p>
          </div>
        </div>
      </header>

      <main className="workspace">
        <aside className="sidebar">
          <UploadPanel workspaceId={workspaceId} onUploaded={onUploaded} />
          <DocumentList
            workspaceId={workspaceId}
            documents={documents}
            onChanged={onUploaded}
          />
        </aside>
        <ChatPanel workspaceId={workspaceId} refreshKey={refreshKey} />
      </main>
    </div>
  );
}
