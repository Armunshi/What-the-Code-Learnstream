import fs from "fs/promises";
import { ApiError } from "../utils/ApiError.js";
import { Assignments } from "../models/assignment.model.js";
import { Courses } from "../models/course.model.js";
import { Lectures } from "../models/lecture.model.js";
import { Modules } from "../models/module.model.js";
import { deleteMediaFromCloudinary } from "./media.service.js";
import * as moduleService from "./module.service.js";
import * as lectureService from "./lecture.service.js";
import * as assignmentService from "./assignment.service.js";

// Creates any number of modules, each with any number of lectures and
// assignments, as ONE all-or-nothing operation — BACKEND_AUDIT.md §3.20.
//
// The form this replaces sent one module, then that module's lectures, then
// its assignments, as N separate sequential requests behind a single click of
// Submit. Closing the browser tab at any point after request 1 didn't corrupt
// anything already sent, but it meant every request still queued after that
// point was simply never made — a teacher's second module, and every
// assignment, silently never existed. This endpoint accepts the whole
// submission in one request, so there is exactly one point at which the
// browser closing can lose anything: before this request is sent at all.
//
// Field naming contract the frontend must follow (see Courseupdatation.jsx):
//   structure         — JSON string, shape: [{ title, description,
//                        lectures: [{ title }], assignments: [{ title, deadline }] }]
//   module_<mi>_lecture_<li>              — that lecture's video file
//   module_<mi>_assignment_<ai>_file_<fi> — one of that assignment's files
//
// Why not a MongoDB transaction: a transaction held open across several
// Cloudinary uploads — each a real, slow, external HTTP call — would keep a
// database session alive for however long those take, which is the opposite
// of what transactions are for. Atomicity here is enforced by explicit
// compensation instead: if anything fails partway, everything already
// created in THIS call is deleted, in reverse order, before the error is
// returned — by id, through atomic $pull/findByIdAndDelete, never by
// re-saving an in-memory document that a later step in the same request may
// have made stale.

const fieldName = {
    lectureVideo: (mi, li) => `module_${mi}_lecture_${li}`,
    assignmentFilePrefix: (mi, ai) => `module_${mi}_assignment_${ai}_file_`,
};

const groupFilesByField = (files) => {
    const byField = new Map();
    for (const file of files) {
        if (!byField.has(file.fieldname)) byField.set(file.fieldname, []);
        byField.get(file.fieldname).push(file);
    }
    return byField;
};

/** Validates the whole submission BEFORE any DB write or Cloudinary upload. */
const validate = (modulesSpec, filesByField) => {
    if (!Array.isArray(modulesSpec) || modulesSpec.length === 0) {
        return ["At least one module is required"];
    }

    const problems = [];
    modulesSpec.forEach((module, mi) => {
        if (!module?.title) problems.push(`Module ${mi + 1} is missing a title`);

        (module.lectures ?? []).forEach((lecture, li) => {
            if (!lecture?.title) problems.push(`Module ${mi + 1}, lecture ${li + 1} is missing a title`);
            if (!filesByField.has(fieldName.lectureVideo(mi, li))) {
                problems.push(`Module ${mi + 1}, lecture ${li + 1} is missing its video file`);
            }
        });

        (module.assignments ?? []).forEach((assignment, ai) => {
            if (!assignment?.title) problems.push(`Module ${mi + 1}, assignment ${ai + 1} is missing a title`);
            const prefix = fieldName.assignmentFilePrefix(mi, ai);
            const hasAnyFile = [...filesByField.keys()].some((key) => key.startsWith(prefix));
            if (!hasAnyFile) {
                problems.push(`Module ${mi + 1}, assignment ${ai + 1} is missing its file(s)`);
            }
        });
    });
    return problems;
};

const collectAssignmentFiles = (filesByField, mi, ai) => {
    const files = [];
    let fi = 0;
    let key = fieldName.assignmentFilePrefix(mi, ai) + fi;
    while (filesByField.has(key)) {
        files.push(...filesByField.get(key));
        fi += 1;
        key = fieldName.assignmentFilePrefix(mi, ai) + fi;
    }
    return files;
};

/** Deletes everything created so far, in reverse order, by id — never by
 * re-saving a held document, since an earlier step in the same request may
 * already have changed that document's fields in the database directly. */
const rollback = async (created) => {
    for (const { assignment, module } of created.assignments.reverse()) {
        try {
            await Promise.allSettled(
                assignment.public_id.map((id, i) =>
                    deleteMediaFromCloudinary(id, assignment.resourceTypes?.[i])
                )
            );
            await Assignments.findByIdAndDelete(assignment._id);
            await Modules.findByIdAndUpdate(module._id, { $pull: { assignments: assignment._id } });
        } catch (error) {
            console.error(`rollback: failed to remove assignment ${assignment._id}:`, error);
        }
    }

    for (const { lecture, module, course } of created.lectures.reverse()) {
        try {
            await deleteMediaFromCloudinary(lecture.public_id, lecture.resource_type);
            await Lectures.findByIdAndDelete(lecture._id);
            await Modules.findByIdAndUpdate(module._id, { $pull: { lectures: lecture._id } });
            await Courses.findByIdAndUpdate(course._id, { $pull: { lectures: lecture._id } });
        } catch (error) {
            console.error(`rollback: failed to remove lecture ${lecture._id}:`, error);
        }
    }

    for (const { module, course } of created.modules.reverse()) {
        try {
            await Modules.findByIdAndDelete(module._id);
            await Courses.findByIdAndUpdate(course._id, { $pull: { modules: module._id } });
        } catch (error) {
            console.error(`rollback: failed to remove module ${module._id}:`, error);
        }
    }
};

export const createModulesBulk = async (course, modulesSpec, files) => {
    const filesByField = groupFilesByField(files);

    const problems = validate(modulesSpec, filesByField);
    if (problems.length > 0) {
        // Nothing was written yet, but multer has already saved these to
        // disk — clean up rather than leave them for the next request's video
        // to accidentally collide with (multer.middleware.js keeps the
        // original filename, not a random one).
        await Promise.allSettled(files.map((file) => fs.unlink(file.path)));
        throw new ApiError(400, `Cannot submit: ${problems.join("; ")}`);
    }

    const created = { modules: [], lectures: [], assignments: [] };

    try {
        for (let mi = 0; mi < modulesSpec.length; mi++) {
            const spec = modulesSpec[mi];
            const module = await moduleService.createModule(course, {
                title: spec.title,
                description: spec.description ?? "",
            });
            created.modules.push({ module, course });

            const lectures = spec.lectures ?? [];
            for (let li = 0; li < lectures.length; li++) {
                const [file] = filesByField.get(fieldName.lectureVideo(mi, li));
                const lecture = await lectureService.addLectureToModule(course, module, {
                    title: lectures[li].title,
                    videoLocalPath: file.path,
                });
                created.lectures.push({ lecture, module, course });
            }

            const assignments = spec.assignments ?? [];
            for (let ai = 0; ai < assignments.length; ai++) {
                const assignment = await assignmentService.createAssignment(course, module, {
                    title: assignments[ai].title,
                    deadline: assignments[ai].deadline,
                    files: collectAssignmentFiles(filesByField, mi, ai),
                });
                created.assignments.push({ assignment, module, course });
            }
        }
    } catch (error) {
        await rollback(created);
        throw error instanceof ApiError
            ? error
            : new ApiError(500, "Could not create modules; nothing was saved and any uploads were rolled back.");
    }

    return moduleService.getCourseWithModules(course._id);
};
