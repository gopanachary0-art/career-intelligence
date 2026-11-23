# Fitcraft — Career Intelligence Assistant

**Option 4** assessment: upload a resume and multiple job postings, then ask about fit, skill gaps, experience alignment, and interview prep.

Example queries: *“What skills am I missing for this role?”* · *“How does my experience align with Job #2?”*

---

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| App | **Next.js 15 (App Router) + TypeScript** | One repo for UI + API; typed end-to-end |
| Vector DB | **PostgreSQL + pgvector** (Docker) | Documents, messages, and embeddings in one datastore |
| LLM / embeddings | **OpenAI** — `gpt-4o-mini` · `text-embedding-3-small` | Good quality/cost; models swap via env |
| Orchestration | **Hand-rolled TypeScript** (no LangChain) | Chunk → embed → retrieve → generate stays readable |
| Validation / tests | **Zod** · **Vitest** | API input checks + unit tests for chunking/guardrails |
| Packaging | **Docker Compose** · Dockerfile (`standalone`) | Reproducible local DB; production-ish container sketch |

---

## a. Quick setup

### Prerequisites

- Node.js 20+
- Docker (for Postgres + pgvector)
- An OpenAI API key

### Steps

```bash
git clone https://github.com/gopanachary0-art/career-intelligence.git
cd career-intelligence
npm install
cp .env.example .env.local
```

Set `OPENAI_API_KEY` in `.env.local`.

```bash
npm run db:up    # starts pgvector/pgvector:pg16 + runs db/init.sql
npm run dev      # http://localhost:3000
```

### Demo path

1. Click **Load demo samples** (sample resume + 3 jobs under `samples/`).
2. Ask: *“What skills am I missing for this role?”* or *“How does my experience align with Job #2?”*
3. Expand **Sources** under an answer to inspect retrieved chunks.

### Commands

| Command | Purpose |
|---|---|
| `npm run test` | Unit tests (chunking + guardrails) |
| `npm run lint` | ESLint |
| `npm run build` | Production build |
| `npm run db:down` | Stop Postgres |

---

## b. Architecture overview

```
Browser (Fitcraft UI)
   │  FormData upload / JSON chat
   ▼
Next.js Route Handlers
   /api/documents  /api/chat  /api/seed  /api/health
   │
   ├─ parse PDF / DOCX / TXT     →  section-aware chunking
   ├─ OpenAI embeddings          →  text-embedding-3-small (1536-d)
   ├─ Postgres + pgvector        →  workspaces, documents, chunks, messages
   └─ retrieve top-k chunks      →  prompt → gpt-4o-mini → answer + citations
```

| Concern | Approach |
|---|---|
| Workspace | Browser UUID in `localStorage` (no auth in this demo) |
| Ingestion | file → extract text → chunk → embed → store vectors |
| Query | guardrails → embed question → cosine search → prompt → LLM → cite |
| One resume | New resume upload replaces the previous one in the workspace |

### Project layout

```
app/                 Next.js UI + API routes
components/          Upload, library, chat
lib/                 chunking, embeddings, retrieval, prompts, guardrails, chat
db/                  schema + SQL init (pgvector)
samples/             demo resume + 3 job postings
__tests__/           Vitest unit tests
docker-compose.yml   local Postgres + pgvector
Dockerfile           Next.js standalone image sketch
```

---

## c. Productionizing on a hyperscaler (AWS / GCP / Azure / Cloudflare)

This repo is a **local demo**. To deploy seriously I would:

1. **Auth & tenancy** — replace `localStorage` workspaces with real users (Clerk / Auth.js / Cognito) and enforce `user_id` / `workspace_id` on every query.
2. **Managed Postgres + pgvector** — RDS/Aurora, Cloud SQL, AlloyDB, or Azure Flexible Server; add **HNSW** indexes once chunk volume grows.
3. **Object storage** — keep original PDFs in S3 / GCS / Azure Blob; store extracted text + embeddings in the DB.
4. **Async ingestion** — queue chunk/embed work (SQS + Lambda, Cloud Tasks, Cloud Run worker) so large uploads do not block HTTP.
5. **Secrets** — Secrets Manager / SSM / Key Vault; never bake `OPENAI_API_KEY` into images.
6. **Scale-out** — run the Next.js standalone image on ECS/Fargate, Cloud Run, or Azure Container Apps; put Cloudflare (or similar) in front for TLS, caching, WAF.
7. **Observability** — structured logs, OpenTelemetry around retrieve/generate, token + latency metrics, eval dashboards.
8. **Cost controls** — per-user rate limits, max context tokens, embedding cache, cheaper models for rewrite-only tasks.
9. **Compliance** — resumes are PII: encryption at rest, retention, residency, and a delete-my-data path.

Cloudflare note: Workers fit the edge API well, but pgvector still needs Postgres somewhere (e.g. Hyperdrive + Neon/Supabase).

---

## d. RAG / LLM approach & decisions

### Choices considered → final pick

| Layer | Considered | Chose | Why |
|---|---|---|---|
| App framework | FastAPI + React, Nest, Next.js | **Next.js + TypeScript** | One repo, fast to demo, typed end-to-end |
| Vector DB | Pinecone, Chroma, pgvector | **Postgres + pgvector** | One datastore; easy Docker story |
| Orchestration | LangChain, LlamaIndex, hand-rolled | **Hand-rolled** | Small corpus; I want the path visible in review |
| Embeddings | `text-embedding-3-small/large`, open-source | **`text-embedding-3-small`** | Quality/cost for English career text |
| Chat LLM | GPT-4o, 4o-mini, Claude | **`gpt-4o-mini`** | Enough for grounded Q&A; env-swappable |
| Chunking | Fixed-size only, splitter libraries | **Section-aware + size cap** | Resume/job headings should stay coherent |

### Chunking

- Detect resume/job section headers (Skills, Experience, Requirements, …).
- Keep section bodies together when possible.
- Fallback: paragraph/sentence splits (~900 chars, overlap ~120).
- Implemented in `lib/chunking.ts`, covered by unit tests.

### Embedding model & LLM

- Embeddings: OpenAI `text-embedding-3-small` → `vector(1536)`.
- Chat: `gpt-4o-mini`, temperature `0.2`.
- Both overridable via `OPENAI_EMBEDDING_MODEL` / `OPENAI_CHAT_MODEL`.

### Retrieval

- Embed the question; cosine distance via pgvector (`<=>`).
- `topK = 8`, minimum score filter, light boosts for “Job #1/#2” and resume-centric wording.
- Context labeled `RESUME` vs `JOB` with section + relevance (`lib/retrieval.ts`).
- Not implemented (on purpose): full BM25 hybrid, RRF, cross-encoder rerank.

### Prompt & context management

- System prompt (`lib/prompts.ts`): ground claims, name jobs by title, never invent employers/skills.
- User prompt includes a **document catalog** plus retrieved excerpts.
- UI returns **citations** (title, section, score, excerpt) so retrieval quality is visible.

### Guardrails

Pre-LLM checks in `lib/guardrails.ts`:

- Require resume + job before fit-style questions.
- Reject empty / oversized prompts.
- Block obvious jailbreak / off-topic strings.
- Light sanitization of model HTML/script tags.

### Quality & observability

**Now:** Vitest for chunking/guardrails, `/api/health`, citations in the UI.

**Next:** golden-question set with expected document IDs, log retrieval IDs / latency / tokens, fail CI if citation hit-rate drops.

---

## e. Key technical decisions

1. **Single Next.js process** — UI and API colocated; fewer moving parts for reviewers.
2. **Hand-rolled RAG** — shows I understand chunk → embed → retrieve → generate without hiding it in a framework.
3. **pgvector in Postgres** — one operational surface for a local demo; production path is still standard managed Postgres.
4. **Drizzle + parameterized SQL for vectors** — ORM for tables; explicit SQL where vector casting matters.
5. **One resume per workspace** — avoids mixing conflicting CVs in chat context.
6. **`/api/seed` demo samples** — reviewers can exercise Job #2 questions without hunting for PDFs.
7. **Env-swappable models** — change chat/embedding models without code edits.

---

## f. Engineering standards followed (and skipped)

**Followed**

- Clear module boundaries (`chunking`, `embeddings`, `retrieval`, `chat`, `guardrails`)
- TypeScript + Zod validation on API inputs
- Docker Compose for reproducible database setup
- Unit tests for pure logic
- `.env.example`, health check, Dockerfile sketch
- Prefer readable names over clever abstractions
- Document known edge cases instead of pretending they are solved

**Skipped on purpose (time box)**

- Auth / multi-tenant hardening
- E2E Playwright suite
- HNSW index (corpus is tiny locally)
- Hybrid BM25 + reranking
- Perfect PDF/OCR reconstruction
- Rate limiting and abuse protection

**Known edge cases**

- Scanned PDFs without OCR → empty extract
- Very large resumes truncate around ~200k characters
- “Job #2” boost works best when titles include “2” / “second” (seed data does)
- Workspace isolation is only as strong as the secrecy of the client UUID

---

## g. How I used AI tools in development

**I designed the structure myself.** Product shape (Option 4), folder/module layout, RAG flow, DB schema, API surface, prompt/guardrail strategy, and README trade-offs were my decisions — not an LLM-generated architecture.

**I used an LLM only for small coding implementation** after that design was fixed: boilerplate, typing glue, short function drafts, and UI CSS tweaks. I did **not** paste the assignment into a model and ship an end-to-end generated app.

**Do’s**

- Decide stack and structure first; then ask for help on a specific file or function
- Ask for options (e.g. pgvector vs Pinecone), then choose myself
- Write architecture and “why” sections in my own words
- Run tests / typecheck after AI-assisted edits
- Keep diffs small and reviewable

**Don’ts**

- Don’t let the model invent the system design
- Don’t accept dependency soup for a demo
- Don’t outsource the thought-process sections of the README

---

## h. What I’d do differently with more time

1. Hybrid search (BM25 + vectors) with Reciprocal Rank Fusion  
2. Structured **fit score** endpoint (skills matrix JSON) alongside free-form chat  
3. Streaming answers (SSE)  
4. Golden-question eval harness in CI  
5. Real auth + per-user document isolation  
6. Better PDF parsing / OCR path  
7. Short product demo recording for reviewers  

---

## Environment variables

Copy `.env.example` → `.env.local`:

| Variable | Purpose |
|---|---|
| `OPENAI_API_KEY` | Required for embeddings + chat |
| `DATABASE_URL` | Postgres connection string (default matches Docker Compose) |
| `OPENAI_CHAT_MODEL` | Default `gpt-4o-mini` |
| `OPENAI_EMBEDDING_MODEL` | Default `text-embedding-3-small` |

Never commit `.env.local`.

---

## License / notes

Built as a take-home assessment demo. Not affiliated with OpenAI. Uploaded resumes stay in your local Postgres volume until you delete them or wipe the Docker volume.
