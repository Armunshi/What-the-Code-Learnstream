import mongoose, { Schema } from 'mongoose'

const assignmentSchema = new Schema({
    // Declared for the first time here — createAssignment (assignment.service.js)
    // has always tried to set this on create(), but Mongoose's default strict
    // mode silently drops any field not in the schema, so it was never actually
    // stored. That silently broke createAssignment's own duplicate-title
    // check, which filters on this field: `findOne({course_id, module_id,
    // title})` matched nothing, ever, because no document had a course_id to
    // match against — confirmed by a real duplicate-title submission that the
    // check should have rejected and didn't. lecture.model.js has always had
    // the equivalent field; this brings assignments in line with it.
    course_id: {
        type: Schema.Types.ObjectId,
        ref: 'Courses',
    },
    module_id: { // Links assignments to modules
        type: Schema.Types.ObjectId,
        ref: 'Modules',
        required: true,
    },
    title: {
        type: String,
        required: true,
    },
    assignmentUrls: [ // URLs for assignment files
        {
            type: String, // Cloudinary or other storage URLs
            default: '',
        },
    ],
    public_id: [ // Cloudinary file IDs
        {
            type: String,
            default: '',
        },
    ],
    // Parallel to `public_id` — same reasoning as lecture.model.js's
    // `resource_type` (BACKEND_AUDIT.md §2.4).
    resourceTypes: [
        {
            type: String,
            default: 'raw',
        },
    ],
    deadline: {
        required: false,
        type: Date,
        default: null,
    },
    uploadedAssignments: [
        {
            studentId: {
                type: Schema.Types.ObjectId,
                ref: 'User',
                required: true,
            },
            submittedAssignmentUrls: [
                {
                    type: String,
                    required: true,
                },
            ],
            uploadedAt: {
                type: Date,
                default: Date.now,
            },
            // Was previously written by submitAssignment but absent from this
            // subschema, so Mongoose's strict mode silently dropped it on
            // every save — lateness was never actually persisted (§2.6).
            submittedOnTime: {
                type: Boolean,
                default: true,
            },
        },
    ],
    checked: [
        {
            studentId: {
                type: Schema.Types.ObjectId,
                ref: 'User',
                required: true,
            },
            isChecked: {
                type: Boolean,
                default: false,
            },
            grading: {
                type: Number, // Grade assigned to the student
                default: null,
            },
            submittedOnTime: {
                type: Boolean, // Whether the submission was on time
                default: true,
            },
        },
    ],
}, { timestamps: true });

export const Assignments = mongoose.model("Assignments", assignmentSchema);
