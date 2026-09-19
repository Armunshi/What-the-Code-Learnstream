import { transcriptVectorStore } from "./vectorStore.js";

const DEFAULT_LIMIT = 5;

/**
 * Embeds `question` and returns its best-matching transcript chunks, scoped
 * to one lecture — collections.js's payload index on `metadata.lectureId` is
 * what makes this a filtered search instead of a scan over every lecture
 * ever ingested. Query embedding happens inside similaritySearchWithScore
 * (via the store's HFEmbeddings instance), not here.
 */
export async function searchLectureChunks({ lectureId, question, limit = DEFAULT_LIMIT }) {
    const results = await transcriptVectorStore.similaritySearchWithScore(question, limit, {
        must: [{ key: "metadata.lectureId", match: { value: String(lectureId) } }],
    });

    return results.map(([doc, score]) => ({
        score,
        text: doc.pageContent,
        startSec: doc.metadata.startSec,
        endSec: doc.metadata.endSec,
        chunkIndex: doc.metadata.chunkIndex,
    }));
}
