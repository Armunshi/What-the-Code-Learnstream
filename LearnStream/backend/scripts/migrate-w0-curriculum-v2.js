// Wave 0 migration (D1, docs/contracts/domain-model.md): builds the new
// CurriculumItems collection from the existing course.modules[] /
// module.lectures[] / module.assignments[] arrays, and stamps a dense
// `order` onto every Sections (modules-collection) document.
//
// Order comes from array position: course.modules[] gives each section's
// order, module.lectures[] gives the order of its video items, and each
// module's assignments are appended after its lectures in the same section
// (module.assignments[] gives their relative order among themselves).
//
// CRITICAL: every CurriculumItem is inserted with the SAME _id as the
// Lecture/Assignment document it was built from. Progress.completedLectures
// stores lectureId as a raw Lectures _id, and the e2e fixture
// (e2e/.auth/test-data.json) hands specs a lectureId captured before this
// migration ever runs — both have to keep resolving after this runs, and the
// only way that works is if the CurriculumItem IS that same _id, not a new
// one that merely references it.
//
// IDEMPOTENCY: a marker in the `migrations` collection makes a second run a
// no-op — see migrate-prices-to-paise.js for the same pattern used elsewhere
// in this repo. Do not delete the marker to "re-run" without checking
// whether curriculumitems already exist; re-inserting would duplicate every
// item under a fresh ordering pass and break the _id-preservation guarantee
// above (a lecture's _id can only ever back one CurriculumItem).
//
// Usage:
//   node scripts/migrate-w0-curriculum-v2.js               # dry run (default)
//   node scripts/migrate-w0-curriculum-v2.js --dry-run      # dry run (explicit)
//   node scripts/migrate-w0-curriculum-v2.js --apply        # actually write

import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import { DB_NAME } from "../src/constants.js";

const APPLY = process.argv.includes("--apply") && !process.argv.includes("--dry-run");
const MIGRATION_ID = "w0-curriculum-v2";

async function main() {
    await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`);
    console.log(`Connected. Mode: ${APPLY ? "APPLY (will write CurriculumItems)" : "DRY RUN (report only)"}`);

    const migrations = mongoose.connection.collection("migrations");
    const already = await migrations.findOne({ _id: MIGRATION_ID });
    if (already) {
        console.log(
            `\nAlready applied at ${already.appliedAt?.toISOString?.() ?? already.appliedAt} ` +
            `(${already.videoCount} video + ${already.assignmentCount} assignment items across ${already.sectionCount} sections). ` +
            `Nothing to do — re-running is a safe no-op.`
        );
        await mongoose.disconnect();
        return;
    }

    const coursesCol = mongoose.connection.collection("courses");
    const modulesCol = mongoose.connection.collection("modules");
    const lecturesCol = mongoose.connection.collection("lectures");
    const assignmentsCol = mongoose.connection.collection("assignments");
    const itemsCol = mongoose.connection.collection("curriculumitems");

    const courses = await coursesCol.find({}).project({ modules: 1, title: 1 }).toArray();
    console.log(`\nCourses found: ${courses.length}`);

    const sectionOps = [];
    const itemOps = [];
    let sectionCount = 0;
    let videoCount = 0;
    let assignmentCount = 0;
    let skippedMissingModules = 0;
    let skippedMissingLectures = 0;
    let skippedMissingAssignments = 0;

    for (const course of courses) {
        const moduleIds = Array.isArray(course.modules) ? course.modules : [];

        for (let mi = 0; mi < moduleIds.length; mi++) {
            const module = await modulesCol.findOne({ _id: moduleIds[mi] });
            if (!module) {
                skippedMissingModules++;
                continue;
            }

            sectionOps.push({
                updateOne: {
                    filter: { _id: module._id },
                    update: { $set: { order: mi, course: module.course ?? course._id } },
                },
            });
            sectionCount++;

            const lectureIds = Array.isArray(module.lectures) ? module.lectures : [];
            const assignmentIds = Array.isArray(module.assignments) ? module.assignments : [];

            for (let li = 0; li < lectureIds.length; li++) {
                const lecture = await lecturesCol.findOne({ _id: lectureIds[li] });
                if (!lecture) {
                    skippedMissingLectures++;
                    continue;
                }

                itemOps.push({
                    updateOne: {
                        filter: { _id: lecture._id },
                        update: {
                            $setOnInsert: {
                                _id: lecture._id,
                                course: course._id,
                                section: module._id,
                                type: "video",
                                title: lecture.title,
                                description: "",
                                order: li,
                                isFreePreview: Boolean(lecture.freePreview),
                                durationSec: lecture.duration ?? 0,
                                resources: [],
                                editVersion: 0,
                                media: {
                                    provider: "cloudinary",
                                    publicId: lecture.public_id,
                                    status: "READY",
                                    statusChangedAt: new Date(),
                                    durationSec: lecture.duration ?? 0,
                                    mp4Url: lecture.videourl,
                                    captions: [],
                                },
                                createdAt: lecture.createdAt ?? new Date(),
                                updatedAt: new Date(),
                            },
                        },
                        upsert: true,
                    },
                });
                videoCount++;
            }

            for (let ai = 0; ai < assignmentIds.length; ai++) {
                const assignment = await assignmentsCol.findOne({ _id: assignmentIds[ai] });
                if (!assignment) {
                    skippedMissingAssignments++;
                    continue;
                }

                itemOps.push({
                    updateOne: {
                        filter: { _id: assignment._id },
                        update: {
                            $setOnInsert: {
                                _id: assignment._id,
                                course: course._id,
                                section: module._id,
                                type: "assignment",
                                title: assignment.title,
                                description: "",
                                // Appended after every lecture in the same section
                                // (D1: "assignments become items appended after the
                                // lectures in the same section").
                                order: lectureIds.length + ai,
                                isFreePreview: false,
                                durationSec: 0,
                                resources: [],
                                editVersion: 0,
                                assignment: assignment._id,
                                createdAt: assignment.createdAt ?? new Date(),
                                updatedAt: new Date(),
                            },
                        },
                        upsert: true,
                    },
                });
                assignmentCount++;
            }
        }
    }

    console.log(`\nSections to stamp with order: ${sectionCount}`);
    console.log(`Video items to create:        ${videoCount}`);
    console.log(`Assignment items to create:   ${assignmentCount}`);
    if (skippedMissingModules) console.log(`Skipped (module id dangling): ${skippedMissingModules}`);
    if (skippedMissingLectures) console.log(`Skipped (lecture id dangling): ${skippedMissingLectures}`);
    if (skippedMissingAssignments) console.log(`Skipped (assignment id dangling): ${skippedMissingAssignments}`);

    if (!APPLY) {
        console.log(`\nDRY RUN — nothing changed.`);
        await mongoose.disconnect();
        return;
    }

    if (sectionOps.length) {
        const result = await modulesCol.bulkWrite(sectionOps);
        console.log(`\nStamped order on ${result.modifiedCount} sections.`);
    }
    if (itemOps.length) {
        const result = await itemsCol.bulkWrite(itemOps);
        console.log(`Inserted ${result.upsertedCount} curriculum items (${result.matchedCount} already existed).`);
    }

    await migrations.insertOne({
        _id: MIGRATION_ID,
        appliedAt: new Date(),
        sectionCount,
        videoCount,
        assignmentCount,
        note: "D1 — CurriculumItems built from course.modules[]/module.lectures[]/module.assignments[], original _ids preserved",
    });

    console.log(`\nRecorded migration marker "${MIGRATION_ID}". Re-runs are now a no-op.`);
    await mongoose.disconnect();
}

main().catch(async (err) => {
    console.error("Migration failed:", err);
    await mongoose.disconnect();
    process.exit(1);
});
