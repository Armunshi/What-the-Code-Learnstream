import { CurriculumItems, VideoItem, AssignmentItem } from "../../models/curriculumItem.model.js";
import { recomputeCurriculumStats } from "../stats/curriculumStats.js";

// Mirrors the LEGACY module/lecture/assignment adapters' writes into the new
// D1 CurriculumItems collection, so a course authored through the old
// endpoints (still the only authoring UI that exists until CURR, Wave 2)
// shows up correctly through the new read paths (GET .../curriculum, GET
// .../items/:itemId/playback) without waiting for someone to run
// migrate-w0-curriculum-v2.js by hand.
//
// Every write here uses the SAME _id as the Lecture/Assignment document it
// mirrors — the same "original _id is preserved" rule the migration script
// follows (docs/contracts/domain-model.md D1), so a lecture/assignment
// created today and one migrated from before Wave 0 are indistinguishable
// to any reader of CurriculumItems.
//
// Deliberately NOT maintaining a perfectly dense `order` on every delete —
// C-NFR-4's dense-order guarantee is enforced by the full-tree curriculum
// PUT (a later, CURR-lane endpoint) whenever an instructor actually reorders
// something; a gap left behind by a legacy delete here is cosmetic (readers
// sort ascending regardless) and re-densifying on every mutation would add
// a bulkWrite per delete for no behavioural difference anyone can observe.

const nextOrderInSection = (sectionId) => CurriculumItems.countDocuments({ section: sectionId });

export const upsertVideoItem = async ({ lecture, course, module }) => {
    const order = await nextOrderInSection(module._id);
    // Through the VideoItem discriminator model, not the base CurriculumItems
    // one: Mongoose merges `{type: 'video'}` into every filter/insert a
    // discriminator model builds, which is what actually gets it persisted
    // on an upsert. Going through the base model here silently dropped the
    // field — `type` doubles as both a plain schema path we don't declare
    // and the discriminatorKey, and only the discriminator model's own
    // machinery knows how to set it.
    await VideoItem.findOneAndUpdate(
        { _id: lecture._id },
        {
            $setOnInsert: { _id: lecture._id, course: course._id, section: module._id, order },
            $set: {
                title: lecture.title,
                isFreePreview: Boolean(lecture.freePreview),
                durationSec: lecture.duration ?? 0,
                media: {
                    provider: "cloudinary",
                    publicId: lecture.public_id,
                    status: "READY",
                    statusChangedAt: new Date(),
                    durationSec: lecture.duration ?? 0,
                    mp4Url: lecture.videourl,
                    captions: [],
                },
            },
        },
        { upsert: true }
    );
    await recomputeCurriculumStats(course._id);
};

export const upsertAssignmentItem = async ({ assignment, course, module }) => {
    const order = await nextOrderInSection(module._id);
    await AssignmentItem.findOneAndUpdate(
        { _id: assignment._id },
        {
            $setOnInsert: { _id: assignment._id, course: course._id, section: module._id, order },
            $set: { title: assignment.title, assignment: assignment._id },
        },
        { upsert: true }
    );
    await recomputeCurriculumStats(course._id);
};

export const removeItem = async ({ itemId, courseId }) => {
    await CurriculumItems.deleteOne({ _id: itemId });
    await recomputeCurriculumStats(courseId);
};

export const removeItemsForSection = async ({ sectionId, courseId }) => {
    await CurriculumItems.deleteMany({ section: sectionId });
    await recomputeCurriculumStats(courseId);
};
