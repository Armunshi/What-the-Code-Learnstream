import mongoose, { Schema } from 'mongoose'

const assignmentSchema = new Schema({
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
