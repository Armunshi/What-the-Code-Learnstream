# LearnStream — Deployment, Data Ingestion & Agentic AI Strategy

Research companion to Module B4. Scope: secondary data sources, RAG/agentic
architecture, and deployment targets. Written against the repository as it
actually stands on 2026-09-12, not a generic MERN template.

> **Status: strategy, not commitment.** Nothing here is implemented. Cost and
> tier specifics for third-party services move quickly and are described by
> shape (relative cost, scaling model) rather than quoted figures — verify
> current pricing before committing.

---

## 0. Three findings that reframe the brief

**0.1 — There is no Python backend.** The brief asks for orchestrators
"compatible with Python backends". The backend is Node.js ESM (`"type":
"module"`), Express 4.21, Mongoose 8.7, deployed on Render. There is no `.py`
file, `requirements.txt`, or `pyproject.toml` anywhere in the repository.

Adopting a Python AI stack means running a **second service in a second
language** — separate deploy, separate CI, separate dependency and secret
management, and a network hop on every request. That is a real cost and it
should be a deliberate choice, not an accident of following Python-first
tutorials. Recommendation: stay in TypeScript/JavaScript (§2.3). Revisit only
if you need a library with no JS equivalent.

**0.2 — The retrieval corpus does not exist yet.** This is the single biggest
blocker, and it sits *upstream* of every vector-database question.

What is actually stored as text today: course `title`, `description`,
`category`; module `title`/`description`; assignment titles and deadlines.
That is a few hundred words per course — thin enough that ordinary MongoDB
text search would answer most of it, and far too thin to justify RAG.

The substance of the product — the teaching — is video and PDF assets on
Cloudinary, with **no transcripts and no extracted text**. Until there is an
ingestion pipeline that transcribes lecture audio and extracts PDF text, a RAG
chatbot has essentially nothing to retrieve and will confidently answer from
the base model instead. Choosing a vector database before solving this is
optimising the wrong layer.

**0.3 — A naive RAG index would re-open the §1.1 vulnerability.** `BACKEND_AUDIT.md`
§1.1 was a *verified production incident*: unauthenticated callers could read
paid course content. B1 closed it by gating `getCourseModules` behind
ownership/enrollment.

An embedding index is a second copy of that same content, in a store that
usually has no concept of enrollment. Retrieval that ignores enrollment
rebuilds the exact bypass that was just fixed — this time in a component
nobody thinks of as a content endpoint, and one that paraphrases rather than
returns verbatim, so it will not trip the same review. **Enrollment filtering
must happen inside the vector query as a metadata pre-filter, never as
post-filtering of results.** This is the hardest security boundary in the plan
and is treated as a first-class requirement throughout (§2.6).

---

## 1. Secondary Data Source Matrix

Candidate external sources, judged for *this* product.

| Source | Value | Integration | Rate limit / auth | Freshness | Risk |
|---|---|---|---|---|---|
| **Own lecture media** (Cloudinary) → transcripts | **Highest.** The only corpus with real teaching content | Batch ETL + ASR (Whisper-class) | Cloudinary API quota; existing creds | On upload | Cost/latency of transcription; accuracy on accented audio |
| **Own relational data** (courses/modules/progress) | High for "what should I study next" | Direct Mongoose reads — no ingestion | None (in-process) | Live | Must respect enrollment |
| Open courseware (MIT OCW, OpenStax) | Medium — supplementary explanation | Batch ETL, permissive licences | Low; mostly unauthenticated | Static | **Licence attribution**; must never be passed off as the teacher's content |
| YouTube Data API | Medium — supplementary video | REST + OAuth | Quota-unit budget, easily exhausted | Near-live | ToS limits on storing transcripts |
| Public datasets (Kaggle/HF) | Low–medium — eval sets, not runtime | Batch download | API token | Static | Licence variance |
| Web scraping | **Avoid** | — | — | — | Legal/ToS exposure, brittle, high upkeep for low marginal value |

### 1.1 Integration approach

| Approach | Fit here | Notes |
|---|---|---|
| **Batch ETL (queue worker)** | **Primary.** Transcription/embedding is slow, bursty, retryable | Must be a background worker, never an HTTP request |
| **Webhooks** | Good — Cloudinary notifies on upload | Same discipline as the Razorpay webhook in B4: verify signature, raw body, idempotent, fast 2xx |
| REST pull | Fine for periodic refresh | Simple; needs scheduling |
| GraphQL | Not justified | No source here requires it |
| WebSockets | Not for ingestion | Relevant only for streaming chat output (§2.5) |

**Reuse B4's fulfilment lesson.** B4 established that an externally-triggered,
retried, at-least-once callback needs an *atomic claim* to stay idempotent
(`src/utils/fulfilment.js`). Cloudinary ingestion webhooks have exactly that
shape: duplicate delivery would re-transcribe and double-index the same
lecture, silently doubling cost and skewing retrieval. Claim the job the same
way — the pattern is already written and proven in this codebase.

---

## 2. Agentic & RAG Architecture Plan

### 2.1 Vector store — recommend **MongoDB Atlas Vector Search**

The data already lives in Atlas. Verify your cluster tier supports Vector
Search before committing.

| Option | Verdict |
|---|---|
| **Atlas Vector Search** | **Recommended.** No new datastore, no sync job, no second backup/auth story. Embeddings sit on the document beside `enrolledStudents`, so the enrollment pre-filter of §0.3 is a normal Mongo query predicate rather than a cross-system join — it makes the critical security control *easy* |
| Qdrant | Strong engine; self-host or cloud. Only worth it at scale Atlas can't serve |
| Pinecone | Fully managed, least ops, but another vendor, another bill, and duplicated access control |
| **pgvector** | **Reject.** Requires adopting Postgres alongside MongoDB — a whole second database for one feature |
| Chroma | Fine for local prototyping; not the production target |

The decisive argument is not benchmark performance — at this corpus size every
option is fast enough. It is that keeping vectors in Atlas makes the
enrollment boundary a single-query invariant instead of a distributed one.

### 2.2 Chunking & embedding

- **Transcripts**: ~500–800 tokens, 10–15% overlap, split on speech
  boundaries. Carry `{courseId, moduleId, lectureId, startTime}` so answers
  deep-link to the timestamp — the feature students actually want.
- **PDFs**: split on headings; keep tables intact.
- **Course/module metadata**: one chunk each; no splitting.
- **Mandatory metadata on every chunk**: `courseId` — the pre-filter key.
- Store `embeddingModel` + `chunkVersion` per chunk so re-embedding can be
  incremental. Changing embedding model invalidates the whole index; assume it
  will happen at least once.

### 2.3 Orchestration — recommend **LangGraph.js**, or no framework at first

Start with **direct SDK calls and a retrieval function**. At this scope that is
perhaps 200 lines, fully debuggable, no abstraction tax. Add a framework when
you have a concrete multi-step need.

| Framework | Fit |
|---|---|
| **LangGraph.js** | Best JS option when you genuinely need cycles/state; explicit graph beats hidden control flow |
| LangChain.js | Broad integrations, heavy abstraction; easy to end up debugging the framework |
| LlamaIndex.TS | Strongest at ingestion/indexing ergonomics |
| Python (LangGraph/LlamaIndex) | Most mature — but see §0.1; costs a second service |

### 2.4 Agentic pattern — start with plain RAG

| Pattern | Verdict |
|---|---|
| **Plain RAG** | **Start here.** "Explain this concept from my lecture" is retrieval, not planning. Covers most of the value |
| Tool use | Add narrowly: `getMyProgress`, `findLecture`. Read-only tools only (§2.6) |
| ReAct | Only if questions genuinely need multi-hop reasoning. Adds latency and failure modes |
| Planning / Multi-agent | **Not justified.** Multi-agent multiplies cost, latency and non-determinism for a tutoring chatbot |

Agentic patterns are a response to task complexity. Adopting them before the
corpus exists (§0.2) buys nothing and makes every failure harder to diagnose.

### 2.5 Streaming interface

**Recommend SSE** (`text/event-stream`). One-directional token streaming is
exactly SSE's shape; it is plain HTTP, survives proxies, and needs no new
protocol in Express. WebSockets add bidirectional complexity for no gain here.
Note Express 4 response buffering and disable compression on that route.

Long ingestion jobs are the opposite case: background queue, never a request.

### 2.6 Guardrails and security boundaries

1. **Enrollment pre-filter — non-negotiable.** Every vector query carries
   `courseId ∈ {student's enrolled courses}`, resolved server-side from the
   session, never from a client parameter. Post-filtering is not acceptable:
   the model has already seen the content by then. This is §1.1 restated.
2. **Never trust `courseId` from the client.** §1.2 was exactly this bug —
   an attacker-controlled course id. Resolve from `req.student._id`.
3. **Read-only tools.** No agent tool may write to orders, enrollments,
   progress or payments. B4 just hardened that surface; do not hand an LLM a
   path around it. Allowlist tools explicitly.
4. **Prompt injection is a live threat**, because retrieved content is
   partly teacher-authored and possibly third-party (§1). Treat retrieved text
   as untrusted data, never as instructions.
5. **PII**: student names/emails must not enter prompts or embeddings.
   §1.4 (tokens in logs) shows the pattern — assume prompts get logged.
6. **Cost controls**: per-student rate limits and a global budget cap.
   Unbounded LLM spend is a denial-of-wallet risk.
7. **Semantic caching**: cache on normalised question + courseId. Cache keys
   must include the enrollment scope or the cache leaks across students.

### 2.7 Failure modes

| Failure | Mitigation |
|---|---|
| Empty/weak retrieval → confident hallucination | Relevance threshold; answer "not covered in your materials" |
| Enrollment filter omitted | Pre-filter enforced in one shared query helper; test it |
| Transcription errors propagate | Show timestamps so students can verify against source |
| Embedding model change | Version chunks; plan re-indexing |
| LLM provider outage | Degrade to keyword search, not a 500 |
| Context truncation | Cap chunks; prefer fewer, higher-scoring ones |

---

## 3. Deployment Strategy Matrix

**Incumbent: Render** (production env vars live there today).

| Target | Setup | CI/CD | Scaling & cost | Background workers | Verdict |
|---|---|---|---|---|---|
| **Render (stay)** | Already live | Git push; add Actions | Instance-based; predictable | **Yes** — Background Workers + Cron | **Recommended.** Lowest switching cost; already supports the worker model ingestion needs |
| Fly.io | Moderate | Good | Fine-grained, regional | Yes | Viable; migration unjustified without a specific need |
| AWS App Runner | Higher (IAM/VPC) | Moderate | Scales to zero | Needs SQS + separate compute | Only with existing AWS commitment |
| Docker + K8s | **Highest** | Heavy | Efficient at scale | Yes | **Reject for now.** Vastly over-provisioned for one app |
| Serverless (Lambda/Vercel) | Low | Easy | Per-request | **Poor fit** | **Reject for the AI path.** Timeouts and cold starts fight both long SSE streams and long transcription jobs |

### 3.1 Fix these before adding any new service

The repo has **no Dockerfile, no `render.yaml`, no CI workflows, and no IaC**.
Independently of AI work:

1. **`start` is `nodemon src/index.js`** — a file-watching dev tool running
   production. Already logged in `BACKEND_AUDIT.md` B5/§4.2. Should be
   `node src/index.js`, with nodemon moved to `devDependencies`.
2. **`test` is `exit 1`** — CI cannot gate on tests. The Playwright suite is
   real and should be wired up.
3. **No CI pipeline.** Add GitHub Actions before adding a second deployable.
4. **Config validation** — B5's `config/env.js` fail-fast matters more once
   there are LLM/vector keys. B4 already showed the shape: the webhook
   refuses loudly when `RAZORPAY_WEBHOOK_SECRET` is missing rather than
   silently no-opping.

Adding an AI service on top of a deployment with no CI, no container
definition and a dev-server entrypoint compounds fragility. **Fix the
foundation first.**

---

## 4. Unified Implementation Roadmap

Ordered by dependency. Phases 1–2 deliver value with no AI at all.

**Phase 0 — Finish B4.** Webhook fulfilment and idempotency. In progress.

**Phase 1 — Deployment hygiene.** Real `start`; nodemon to devDependencies;
GitHub Actions running the Playwright suite; `config/env.js`. *No AI yet.*

**Phase 2 — Build the corpus (the actual unlock).** Cloudinary upload webhook
(signature-verified, idempotent — reuse B4's claim pattern) → background
worker → ASR transcripts + PDF text → store with
`{courseId, moduleId, lectureId, startTime}`. Ship transcripts as a visible
feature: searchable, accessible, deep-linkable. **Valuable on its own even if
the chatbot is never built** — and it de-risks the whole AI bet, because if
transcription quality is poor you learn it here, cheaply.

**Phase 3 — Retrieval.** Atlas Vector Search index; embed Phase 2 output;
enrollment pre-filter in one shared helper, with tests that assert a
non-enrolled student retrieves nothing.

**Phase 4 — Plain RAG chatbot.** SSE streaming, citations with timestamps,
relevance threshold, rate limits, semantic caching. No agent loop.

**Phase 5 — Narrow tool use, only if warranted.** Read-only `getMyProgress`,
`findLecture`. Revisit agentic patterns only against real logged failures.

### Risk register

| Risk | Severity | Note |
|---|---|---|
| Enrollment leak via retrieval | **Critical** | Recreates §1.1 in a new surface |
| Corpus never materialises | **High** | Phase 2 is the real project; RAG is the easy part |
| Second language/runtime (Python) | Medium | §0.1 — avoidable |
| Unbounded LLM cost | Medium | Budget caps from day one |
| Transcription quality | Medium | Phase 2 surfaces this early and cheaply |
| Premature multi-agent complexity | Medium | Non-determinism without matching benefit |
