import { hf } from "../../config/huggingface.js";
import { env } from "../../config/env.js";

// BGE's own model card: v1.5 models want this prepended to a QUERY (never to
// a passage) for retrieval — asymmetric by design, which is why this file
// has two functions instead of one. Baked in here rather than left to each
// caller so nobody embedding a question forgets it and silently degrades
// retrieval quality.
const QUERY_INSTRUCTION = "Represent this sentence for searching relevant passages: ";

// Transcript chunks at ingestion time — no instruction prefix.
export async function embedPassages(texts) {
    if (texts.length === 0) return [];
    return hf.featureExtraction({
        model: env.huggingFace.embeddingModel,
        provider: "hf-inference",
        inputs: texts,
        normalize: true, // cosine distance (collections.js) assumes unit-normalized vectors
    });
}

// A single student question, asked while a lecture is playing.
export async function embedQuery(text) {
    const [vector] = await hf.featureExtraction({
        model: env.huggingFace.embeddingModel,
        provider: "hf-inference",
        inputs: [QUERY_INSTRUCTION + text],
        normalize: true,
    });
    return vector;
}
