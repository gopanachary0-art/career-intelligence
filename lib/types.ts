export type DocType = "resume" | "job";

export type Citation = {
  documentId: string;
  documentTitle: string;
  docType: DocType;
  section: string | null;
  excerpt: string;
  score: number;
};

export type RetrievedChunk = {
  id: string;
  documentId: string;
  documentTitle: string;
  docType: DocType;
  content: string;
  section: string | null;
  score: number;
};

export type ChatResponse = {
  answer: string;
  citations: Citation[];
  guardrail?: string | null;
};

export type DocumentSummary = {
  id: string;
  docType: DocType;
  title: string;
  filename: string;
  createdAt: string;
  chunkCount: number;
};
