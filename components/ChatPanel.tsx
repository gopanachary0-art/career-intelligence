"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { SUGGESTED_PROMPTS } from "@/lib/prompts";
import type { Citation } from "@/lib/types";

type UiMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
};

type Props = {
  workspaceId: string;
  refreshKey: number;
};

export function ChatPanel({ workspaceId, refreshKey }: Props) {
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(
        `/api/chat?workspaceId=${encodeURIComponent(workspaceId)}`,
      );
      if (!res.ok || cancelled) return;
      const data = await res.json();
      setMessages(
        (data.messages || [])
          .filter((m: { role: string }) => m.role === "user" || m.role === "assistant")
          .map((m: UiMessage) => m),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [workspaceId, refreshKey]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  async function ask(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    setBusy(true);
    setError(null);
    setQuestion("");
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "user", content: q },
    ]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, question: q }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Chat failed");

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.answer,
          citations: data.citations,
        },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chat failed");
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void ask(question);
  }

  return (
    <section className="chat panel">
      <header className="panel-head">
        <h2>Ask Fitcraft</h2>
        <p>Answers are grounded in your uploaded resume and jobs.</p>
      </header>

      <div className="suggestions">
        {SUGGESTED_PROMPTS.map((p) => (
          <button key={p} type="button" onClick={() => void ask(p)} disabled={busy}>
            {p}
          </button>
        ))}
      </div>

      <div className="thread" aria-live="polite">
        {messages.length === 0 && (
          <div className="empty-chat">
            <p>
              Upload documents, then ask about skill gaps, alignment, or interview prep.
            </p>
          </div>
        )}
        {messages.map((m) => (
          <article key={m.id} className={`bubble bubble-${m.role}`}>
            <div className="bubble-label">
              {m.role === "user" ? "You" : "Fitcraft"}
            </div>
            <div className="bubble-body">{m.content}</div>
            {m.citations && m.citations.length > 0 && (
              <details className="citations">
                <summary>Sources ({m.citations.length})</summary>
                <ul>
                  {m.citations.map((c, i) => (
                    <li key={`${c.documentId}-${i}`}>
                      <strong>
                        {c.docType === "resume" ? "Resume" : "Job"} · {c.documentTitle}
                      </strong>
                      {c.section ? ` · ${c.section}` : ""}
                      <span> · score {c.score}</span>
                      <p>{c.excerpt}</p>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </article>
        ))}
        {busy && (
          <article className="bubble bubble-assistant thinking">
            <div className="bubble-label">Fitcraft</div>
            <div className="bubble-body">Retrieving context and drafting…</div>
          </article>
        )}
        <div ref={bottomRef} />
      </div>

      {error && <p className="err-msg">{error}</p>}

      <form className="composer" onSubmit={onSubmit}>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="What skills am I missing for Job #2?"
          rows={2}
          disabled={busy}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void ask(question);
            }
          }}
        />
        <button type="submit" disabled={busy || !question.trim()}>
          Ask
        </button>
      </form>
    </section>
  );
}
