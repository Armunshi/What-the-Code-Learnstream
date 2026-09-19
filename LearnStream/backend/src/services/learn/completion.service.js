import { ApiError } from "../../utils/ApiError.js";
import { CurriculumItems } from "../../models/curriculumItem.model.js";
import { Assignments } from "../../models/assignment.model.js";
import { markItemComplete } from "./progress.service.js";

const idsMatch = (a, b) => Boolean(a) && Boolean(b) && a.toString() === b.toString();

/**
 * `POST /learn/:courseId/items/:itemId/complete` (D5): article, resource and
 * assignment complete this way; video never does (it only auto-completes
 * from watch progress, `watch.service.js`), and quiz never does either (a
 * passing attempt calls `markItemComplete` directly — W3-QUIZ).
 */
export async function completeItem({ studentId, courseId, itemId }) {
    const item = await CurriculumItems.findOne({ _id: itemId, course: courseId });
    if (!item) throw new ApiError(404, "Item not found");

    if (item.type === "video") {
        throw new ApiError(400, "Video items complete automatically from watch progress, not this endpoint");
    }
    if (item.type === "quiz") {
        throw new ApiError(400, "Quiz items complete automatically from a passing attempt, not this endpoint");
    }

    if (item.type === "assignment") {
        const assignment = item.assignment ? await Assignments.findById(item.assignment) : null;
        const hasSubmission = assignment?.uploadedAssignments?.some((submission) =>
            idsMatch(submission.studentId, studentId)
        );
        if (!hasSubmission) {
            throw new ApiError(400, "Submit the assignment before marking it complete");
        }
    }

    // article, resource: no extra verification — the learner's own click is
    // the "I read/downloaded this" signal.
    return markItemComplete({ studentId, courseId, itemId });
}
