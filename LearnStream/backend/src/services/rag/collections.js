import { env } from "../../config/env.js";

// Schema for the one collection Phase 1 needs: chunks of a lecture's
// transcript, embedded and scoped so a question asked during playback can be
// retrieved against just that lecture (or, later, the whole course).
//
// One point per chunk. `id` is a stable uuid derived from
// `${lectureId}:${chunkIndex}` (services/rag/ids.js), so re-ingesting a
// lecture after a transcript edit overwrites matching chunks instead of
// duplicating them. That alone doesn't cover a transcript edit that
// produces FEWER chunks than before, so ingestTranscript.js also deletes
// every existing point for a lectureId before writing the new set —
// belt-and-suspenders against orphaned points from a shrunk transcript.
export const TRANSCRIPT_CHUNKS_COLLECTION = env.qdrant.collection;

export const TRANSCRIPT_CHUNKS_VECTOR_PARAMS = {
    size: env.qdrant.embeddingDim,
    distance: "Cosine",
};

// m/ef_construct above Qdrant's defaults (16/100): this collection is small
// (one course's worth of transcripts, not billions of points) and read far
// more than it's written, so it's worth spending extra index-build time for
// better recall on every query. Revisit if/when ingestion volume makes
// collection-build time the bottleneck instead.
export const TRANSCRIPT_CHUNKS_HNSW_CONFIG = {
    m: 16,
    ef_construct: 200,
};

// Payload fields queries filter on, so retrieval can be scoped to "this
// lecture" (chat during playback) or "this course" (a course-wide assistant,
// if that's ever added) without a full collection scan.
//
// Dot-path "metadata.*", not a bare field name: ingestion goes through
// @langchain/qdrant's QdrantVectorStore (vectorStore.js), which writes every
// point as `{ content: <text>, metadata: {...} }` — lectureId/courseId live
// under metadata, not at the payload's top level, so the index (and every
// filter in search.js/ingestTranscript.js) has to name that real path.
export const TRANSCRIPT_CHUNKS_PAYLOAD_INDEXES = [
    { field_name: "metadata.lectureId", field_schema: "keyword" },
    { field_name: "metadata.courseId", field_schema: "keyword" },
];
