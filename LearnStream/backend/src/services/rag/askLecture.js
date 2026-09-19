import { ApiError } from "../../utils/ApiError.js";
import { searchLectureChunks } from "./search.js";
import { generateAnswer } from "./generateAnswer.js";

// Cosine similarity floor below which a retrieved chunk is treated as "not
// actually about this question" rather than passed to the model as context.
// Rough starting point, not a tuned constant — BAAI/bge-base-en-v1.5's own
// smoke test (services/rag/embed.js verification) scored a genuinely
// relevant pair at ~0.75 and an unrelated one at ~0.41; 0.35 errs toward
// still forwarding borderline chunks for the model to judge rather than
// silently dropping a real match. Phase 3's retrieval eval is what should
// replace this guess with a measured threshold.
const MIN_RELEVANCE_SCORE = 0.35;

/** Retrieve-then-generate: embed the question, search this lecture's transcript, answer from what's found. */
export async function askAboutLecture({ lectureId, question }) {
    const trimmed = question?.trim();
    if (!trimmed) {
        throw new ApiError(400, "A question is required");
    }

    const results = await searchLectureChunks({ lectureId, question: trimmed });
    const relevant = results.filter((chunk) => chunk.score >= MIN_RELEVANCE_SCORE);

    const { answer, grounded } = await generateAnswer({ question: trimmed, chunks: relevant });

    return {
        answer,
        grounded,
        citations: relevant.map((chunk) => ({
            startSec: chunk.startSec,
            endSec: chunk.endSec,
            score: chunk.score,
        })),
    };
}
