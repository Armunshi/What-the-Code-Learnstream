import { qdrant } from "../../config/qdrant.js";
import {
    TRANSCRIPT_CHUNKS_COLLECTION,
    TRANSCRIPT_CHUNKS_HNSW_CONFIG,
    TRANSCRIPT_CHUNKS_PAYLOAD_INDEXES,
    TRANSCRIPT_CHUNKS_VECTOR_PARAMS,
} from "./collections.js";

// Idempotent setup: safe to call on every deploy, not just once by hand.
// Creates the collection if it's missing, then makes sure every payload
// index in collections.js exists — separately, because a collection created
// by an older version of this function (or a manual `qdrant:init` run that
// died partway) may already exist without one of them.
export async function ensureTranscriptChunksCollection() {
    const { exists } = await qdrant.collectionExists(TRANSCRIPT_CHUNKS_COLLECTION);

    if (!exists) {
        await qdrant.createCollection(TRANSCRIPT_CHUNKS_COLLECTION, {
            vectors: TRANSCRIPT_CHUNKS_VECTOR_PARAMS,
            hnsw_config: TRANSCRIPT_CHUNKS_HNSW_CONFIG,
        });
    }

    for (const index of TRANSCRIPT_CHUNKS_PAYLOAD_INDEXES) {
        await createPayloadIndexIfMissing(index);
    }

    return { created: !exists, collection: TRANSCRIPT_CHUNKS_COLLECTION };
}

async function createPayloadIndexIfMissing({ field_name, field_schema }) {
    try {
        await qdrant.createPayloadIndex(TRANSCRIPT_CHUNKS_COLLECTION, { field_name, field_schema });
    } catch (error) {
        // Qdrant has no "create index if not exists" — re-running this
        // against a collection that already has the index is the normal
        // case (every redeploy calls ensureTranscriptChunksCollection), so
        // that specific failure is expected, not an error to surface.
        const message = String(error?.data?.status?.error ?? error?.message ?? "");
        if (!message.toLowerCase().includes("already exists")) {
            throw error;
        }
    }
}
