// One-off cleanup migration for BACKEND_AUDIT.md §2.3.
//
// Before this session's fix, deleting a module never actually cascaded:
// its `pre('remove')` hook was dead code (Mongoose 8 removed document
// `remove()` entirely), so every past module deletion left behind
//   (a) orphaned Lectures/Assignments documents whose `module_id` points at
//       a Module that no longer exists, and
//   (b) dangling ids in the parent course's `modules[]`/`lectures[]`/
//       `assignments[]` arrays, pointing at documents that no longer exist.
//
// This script finds both classes of leftover and, only when run with
// --apply, deletes the orphaned documents (Cloudinary asset included) and
// $pulls the dangling ids. Without --apply it only reports counts — nothing
// is changed. Safe to run repeatedly; a clean database reports zero on every
// line.
//
// Usage:
//   node scripts/cleanup-orphaned-module-content.js            # dry run (report only)
//   node scripts/cleanup-orphaned-module-content.js --apply    # actually delete/clean

import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import { DB_NAME } from "../src/constants.js";
import { Assignments } from "../src/models/assignment.model.js";
import { Courses } from "../src/models/course.model.js";
import { Lectures } from "../src/models/lecture.model.js";
import { Modules } from "../src/models/module.model.js";
import { deleteMediaFromCloudinary } from "../src/services/media.service.js";

const APPLY = process.argv.includes("--apply");

async function main() {
    await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`);
    console.log(`Connected. Mode: ${APPLY ? "APPLY (will delete/modify)" : "DRY RUN (report only)"}`);

    const moduleIds = new Set((await Modules.find().select("_id")).map((m) => m._id.toString()));

    // --- Orphaned lectures/assignments (module_id points at a dead Module) ---
    const orphanedLectures = await Lectures.find({ module_id: { $nin: [...moduleIds].map((id) => new mongoose.Types.ObjectId(id)) } });
    const orphanedAssignments = await Assignments.find({ module_id: { $nin: [...moduleIds].map((id) => new mongoose.Types.ObjectId(id)) } });

    console.log(`\nOrphaned lectures (dead module_id): ${orphanedLectures.length}`);
    console.log(`Orphaned assignments (dead module_id): ${orphanedAssignments.length}`);

    if (APPLY) {
        for (const lecture of orphanedLectures) {
            try {
                await deleteMediaFromCloudinary(lecture.public_id, lecture.resource_type);
            } catch (err) {
                console.error(`  Cloudinary cleanup failed for lecture ${lecture._id}:`, err.message);
            }
        }
        if (orphanedLectures.length) {
            await Lectures.deleteMany({ _id: { $in: orphanedLectures.map((l) => l._id) } });
        }

        for (const assignment of orphanedAssignments) {
            const results = await Promise.allSettled(
                assignment.public_id.map((id, i) => deleteMediaFromCloudinary(id, assignment.resourceTypes?.[i]))
            );
            results.forEach((r) => {
                if (r.status === "rejected") {
                    console.error(`  Cloudinary cleanup failed for assignment ${assignment._id}:`, r.reason?.message);
                }
            });
        }
        if (orphanedAssignments.length) {
            await Assignments.deleteMany({ _id: { $in: orphanedAssignments.map((a) => a._id) } });
        }
        console.log("Deleted orphaned lectures/assignments (DB + Cloudinary).");
    }

    // --- Dangling ids in course.modules[]/lectures[]/assignments[] ---
    const lectureIds = new Set((await Lectures.find().select("_id")).map((l) => l._id.toString()));
    const assignmentIds = new Set((await Assignments.find().select("_id")).map((a) => a._id.toString()));

    const courses = await Courses.find();
    let coursesWithDanglingModules = 0;
    let coursesWithDanglingLectures = 0;
    let coursesWithDanglingAssignments = 0;

    for (const course of courses) {
        const cleanModules = course.modules.filter((id) => moduleIds.has(id.toString()));
        const cleanLectures = course.lectures.filter((id) => lectureIds.has(id.toString()));
        const cleanAssignments = course.assignments.filter((id) => assignmentIds.has(id.toString()));

        const modulesDangling = cleanModules.length !== course.modules.length;
        const lecturesDangling = cleanLectures.length !== course.lectures.length;
        const assignmentsDangling = cleanAssignments.length !== course.assignments.length;

        if (modulesDangling) coursesWithDanglingModules++;
        if (lecturesDangling) coursesWithDanglingLectures++;
        if (assignmentsDangling) coursesWithDanglingAssignments++;

        if (APPLY && (modulesDangling || lecturesDangling || assignmentsDangling)) {
            course.modules = cleanModules;
            course.lectures = cleanLectures;
            course.assignments = cleanAssignments;
            await course.save();
        }
    }

    console.log(`\nCourses with dangling modules[] ids: ${coursesWithDanglingModules}`);
    console.log(`Courses with dangling lectures[] ids: ${coursesWithDanglingLectures}`);
    console.log(`Courses with dangling assignments[] ids: ${coursesWithDanglingAssignments}`);
    if (APPLY) {
        console.log("Cleaned dangling ids out of affected courses.");
    } else if (
        orphanedLectures.length || orphanedAssignments.length ||
        coursesWithDanglingModules || coursesWithDanglingLectures || coursesWithDanglingAssignments
    ) {
        console.log("\nRe-run with --apply to fix the above.");
    } else {
        console.log("\nNothing to clean up.");
    }

    await mongoose.disconnect();
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
