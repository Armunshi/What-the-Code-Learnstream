import { hf } from "../../config/huggingface.js";
import { env } from "../../config/env.js";

// Grounded-only, explicitly told to admit when the excerpts don't cover the
// question rather than fill the gap from the model's own knowledge — the
// one instruction most responsible for whether Phase 3's later faithfulness/
// groundedness eval comes back clean or not.
const SYSTEM_PROMPT = `You are a lecture assistant answering a student's question about the video lecture currently playing.
Answer ONLY using the transcript excerpts provided below. If the excerpts do not contain the answer, say so plainly instead of guessing — never invent information the lecture did not cover.
Keep the answer concise and directly address the question. Some excerpts are labeled with a [mm:ss–mm:ss] timestamp and some are not (the transcript source has no timing information, e.g. a PDF or plain-text upload) — when an excerpt you use HAS a timestamp, you may mention it; when it does not, do not invent or guess one.`;

function formatTimestamp(sec) {
    if (sec == null) return null;
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
}

function buildContext(chunks) {
    return chunks
        .map((chunk, i) => {
            const span = chunk.startSec != null ? ` [${formatTimestamp(chunk.startSec)}–${formatTimestamp(chunk.endSec)}]` : "";
            return `Excerpt ${i + 1}${span}:\n${chunk.text}`;
        })
        .join("\n\n");
}

/**
 * Generates a grounded answer from already-retrieved chunks. Deliberately
 * takes `chunks`, not a lectureId — retrieval (search.js) and generation are
 * two separate steps on purpose (Phase 3's eval plan tests them separately
 * before testing them together), not because this function can't be trusted
 * to also search.
 */
export async function generateAnswer({ question, chunks }) {
    if (chunks.length === 0) {
        return {
            answer: "I couldn't find anything in this lecture covering that — could you rephrase, or is this from a different lecture?",
            grounded: false,
        };
    }

    const response = await hf.chatCompletion({
        model: env.huggingFace.chatModel,
        // Not hf-inference: HF's own free serverless provider currently
        // serves embedding/classification/other small-NLP models only — zero
        // chat-completion models, confirmed by querying
        // huggingface.co/api/models?inference_provider=hf-inference. This
        // model's own /api/models/<id>?expand[]=inferenceProviderMapping
        // lists featherless-ai as "live" for its conversational task, and a
        // real call confirmed it works with this account's token.
        provider: "featherless-ai",
        messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: `Transcript excerpts:\n\n${buildContext(chunks)}\n\nQuestion: ${question}` },
        ],
        max_tokens: 500,
        temperature: 0.2,
    });

    return {
        answer: response.choices[0]?.message?.content?.trim() ?? "",
        grounded: true,
    };
}
