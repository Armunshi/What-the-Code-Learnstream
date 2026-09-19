import { ApiError } from "../../utils/ApiError.js";
import { Modules } from "../../models/module.model.js";
import { transcriptVectorStore } from "./vectorStore.js";
import { parseTranscript } from "./parseTranscript.js";
import { extractPdfText } from "./parsePdf.js";
import { chunkSegments } from "./chunkSegments.js";
import { chunkPointId } from "./ids.js";

const PDF_MAGIC = "%PDF-";

async function fetchTranscriptBytes(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new ApiError(502, `Could not fetch transcript from storage (HTTP ${response.status})`);
    }
    return Buffer.from(await response.arrayBuffer());
}

// The upload route (lectures.routes.js's .../transcript endpoint) accepts
// any file with no format field recorded anywhere (same reasoning as
// parseTranscript.js's sniffFormat), so a PDF transcript is told apart from
// VTT/SRT/plain text by its own magic bytes, not by URL extension or
// Content-Type. Real PDFs are binary — decoding one as UTF-8 text first
// (the non-PDF path) would corrupt it before extraction ever ran.
function isPdf(bytes) {
    return bytes.subarray(0, PDF_MAGIC.length).toString("latin1") === PDF_MAGIC;
}

async function extractTranscriptText(bytes) {
    return isPdf(bytes) ? extractPdfText(bytes) : bytes.toString("utf-8");
}

/**
 * Reads a lecture's uploaded transcript, chunks it, embeds every chunk (both
 * via vectorStore.js's QdrantVectorStore, which drives HFEmbeddings and the
 * raw Qdrant client internally), and (re-)populates its slice of the
 * collection. Safe to call again after a teacher replaces the transcript —
 * old points for this lecture are deleted before the new ones are written,
 * so a transcript edit that changes the chunk count never leaves orphaned
 * points behind, on top of chunkPointId's own stable-id overwrite for chunks
 * that just changed text.
 */
export async function ingestLectureTranscript(lecture) {
    if (!lecture.transcriptUrl) {
        throw new ApiError(400, "This lecture has no transcript uploaded yet");
    }

    const lectureId = String(lecture._id);
    const moduleId = String(lecture.module_id);

    // Lecture.course_id exists in the schema but no write path in this
    // codebase ever sets it (addLectureToModule only sets module_id) — the
    // real course reference lives on the module/section document instead,
    // the same place updateLectureDetails (lecture.service.js) reads it
    // from. Trusting course_id here would have stamped every chunk's
    // courseId payload with the literal string "undefined".
    const module = await Modules.findById(lecture.module_id).select("course");
    if (!module) {
        throw new ApiError(404, "Lecture's module was not found — cannot resolve its course");
    }
    const courseId = String(module.course);

    const bytes = await fetchTranscriptBytes(lecture.transcriptUrl);
    const rawText = await extractTranscriptText(bytes);
    const segments = parseTranscript(rawText);
    const chunks = await chunkSegments(segments);

    // Clear this lecture's old points first, regardless of whether the new
    // transcript produced any chunks — re-ingesting an emptied-out
    // transcript should leave the collection with nothing for it, not stale
    // chunks from whatever used to be there.
    await transcriptVectorStore.delete({
        filter: { must: [{ key: "metadata.lectureId", match: { value: lectureId } }] },
    });

    if (chunks.length === 0) {
        return { lectureId, chunkCount: 0 };
    }

    const documents = chunks.map((chunk, index) => ({
        pageContent: chunk.text,
        metadata: {
            lectureId,
            courseId,
            moduleId,
            chunkIndex: index,
            startSec: chunk.startSec,
            endSec: chunk.endSec,
        },
    }));
    const ids = chunks.map((_, index) => chunkPointId(lectureId, index));

    await transcriptVectorStore.addDocuments(documents, { ids });

    return { lectureId, chunkCount: documents.length };
}
