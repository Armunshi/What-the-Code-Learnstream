import mongoose, { Schema } from 'mongoose'

const lectureSchema = new Schema({
    title: {
        type: String,
        required: true
    },
    videourl: {
        type: String, // cloudinary url
        required: true
    },
    duration: {
        type: Number,
        required: true
    },
    public_id: {
        type: String,
        required: true
    },
    // Cloudinary's `uploader.destroy()` defaults to resource_type "image" and
    // silently no-ops otherwise — this has to be stored at upload time so
    // deletes can pass the right one back (BACKEND_AUDIT.md §2.4).
    resource_type: {
        type: String,
        default: "video"
    },
    freePreview: {
        type: Boolean,
        default: false
    },
    // Plumbing for a future lecture-level RAG chatbot: a teacher-uploaded
    // transcript file (plain text/VTT/SRT for now — no processing happens
    // here, this just stores where it lives). transcriptResourceType
    // mirrors `resource_type` above for the same reason: Cloudinary's
    // destroy() needs the real type back or it silently no-ops.
    transcriptUrl: {
        type: String,
        default: null,
    },
    transcriptPublicId: {
        type: String,
        default: null,
    },
    transcriptResourceType: {
        type: String,
        default: null,
    },
    course_id: {
        type: Schema.Types.ObjectId,
        ref: 'Courses'
    },
    module_id: { // Links lectures to modules
        type: Schema.Types.ObjectId,
        ref: 'Sections',
        required: true,
    }
}, {
    timestamps: true
})

export const Lectures = mongoose.model("Lectures", lectureSchema);
