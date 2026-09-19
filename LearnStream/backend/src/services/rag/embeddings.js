import { Embeddings } from "@langchain/core/embeddings";
import { embedPassages, embedQuery } from "./embed.js";

// Kept well under whatever the free hf-inference tier's per-request limits
// turn out to be — moved here (from the old manual loop in ingestTranscript.js)
// so the same safety applies to every caller that now only reaches HF through
// this adapter, e.g. QdrantVectorStore.addDocuments passing its whole batch
// of chunk texts through embedDocuments in one call.
const EMBED_BATCH_SIZE = 32;

/**
 * Adapts embed.js's HF-backed functions (the actual @huggingface/inference
 * calls, unchanged) to LangChain's Embeddings interface, so @langchain/qdrant
 * can call them internally without knowing anything about HF.
 */
export class HFEmbeddings extends Embeddings {
    constructor() {
        super({});
    }

    async embedDocuments(texts) {
        const vectors = [];
        for (let i = 0; i < texts.length; i += EMBED_BATCH_SIZE) {
            vectors.push(...(await embedPassages(texts.slice(i, i + EMBED_BATCH_SIZE))));
        }
        return vectors;
    }

    embedQuery(text) {
        return embedQuery(text);
    }
}
