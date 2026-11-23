import type { DocumentSummary } from "./types";

const OFF_TOPIC =
  /\b(ignore (all |previous )?instructions|jailbreak|system prompt|hack into|build a bomb|write malware)\b/i;

const CAREER_HINT =
  /\b(resume|job|skill|interview|career|experience|gap|fit|role|hiring|salary|cover letter|portfolio)\b/i;

export type GuardrailResult =
  | { ok: true }
  | { ok: false; message: string };

/**
 * Cheap pre-LLM checks. These are intentionally conservative for a demo:
 * block obvious prompt-injection / off-topic, and require a resume before
 * answering fit questions.
 */
export function preflightGuardrails(
  question: string,
  catalog: DocumentSummary[],
): GuardrailResult {
  const q = question.trim();
  if (!q) {
    return { ok: false, message: "Ask a question about your resume or jobs." };
  }
  if (q.length > 2000) {
    return { ok: false, message: "Please keep questions under 2000 characters." };
  }
  if (OFF_TOPIC.test(q)) {
    return {
      ok: false,
      message:
        "I can only help with career fit analysis based on your uploaded documents.",
    };
  }

  const hasResume = catalog.some((d) => d.docType === "resume");
  const hasJob = catalog.some((d) => d.docType === "job");
  const asksFit =
    /\b(fit|gap|missing|align|match|compare|interview|skill)\b/i.test(q);

  if (asksFit && !hasResume) {
    return {
      ok: false,
      message: "Upload a resume first so I can ground answers in your experience.",
    };
  }
  if (asksFit && !hasJob) {
    return {
      ok: false,
      message: "Upload at least one job description to compare against your resume.",
    };
  }

  // Soft nudge only — still allow through if vaguely related
  if (!CAREER_HINT.test(q) && q.split(/\s+/).length > 12) {
    return {
      ok: false,
      message:
        "I'm focused on resume–job fit. Try asking about skills, gaps, alignment, or interview prep.",
    };
  }

  return { ok: true };
}

export function sanitizeModelOutput(text: string): string {
  return text
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<\/?script[^>]*>/gi, "")
    .trim();
}
