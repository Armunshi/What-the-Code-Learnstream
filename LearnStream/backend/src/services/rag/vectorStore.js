import { QdrantVectorStore } from "@langchain/qdrant";
import { qdrant } from "../../config/qdrant.js";
import { HFEmbeddings } from "./embeddings.js";
import { TRANSCRIPT_CHUNKS_COLLECTION } from "./collections.js";

// Reuses config/qdrant.js's client — the same connection every other RAG
// module goes through — rather than letting the store open its own via
// url/apiKey. Collection creation and payload indexes are NOT this store's
// job: ensureCollection.js still owns those (custom HNSW config and
// createPayloadIndex aren't exposed through this wrapper), and must run
// (via `npm run qdrant:init`) before anything here is called.
//
// Default payload shape this store writes: `{ content: <pageContent>,
// metadata: {...} }` — collections.js's payload indexes and every filter in
// this codebase key off `metadata.lectureId`/`metadata.courseId` to match.
export const transcriptVectorStore = new QdrantVectorStore(new HFEmbeddings(), {
    client: qdrant,
    collectionName: TRANSCRIPT_CHUNKS_COLLECTION,
});
