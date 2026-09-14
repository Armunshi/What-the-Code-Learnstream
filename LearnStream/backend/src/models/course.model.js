import mongoose, { Schema } from 'mongoose'
import { mediaSchema } from './schemas/media.schema.js'
import { COURSE_STATUS, COURSE_STATUS_VALUES } from '../config/courseLifecycle.js'

const courseSchema = new Schema({
    thumbnail: {
        type: String,
        required: true
    },
    thumbnailPublicId: { type: String },
    thumbnailAlt: { type: String },
    promoVideo: { type: mediaSchema, default: () => ({}) },
    isLive: {
        type: Boolean,
        default: false,
    },
    title: {
        type: String,
        required: true,
        maxlength: 60,
    },
    subtitle: { type: String, maxlength: 120 },
    description: {
        type: String,
        required: true
    },
    // Integer paise, never rupees and never a float (BACKEND_AUDIT.md §2.7).
    // ₹499 is stored as 49900. Rupees exist only at the input and display
    // edges of the frontend; every amount crossing the API or reaching
    // Razorpay is paise. Storing rupees as a Number allowed 19.99, and
    // 19.99 * 100 is 1998.9999999999998 in IEEE-754, which Razorpay rejects.
    price: {
        type: Number,
        required: true,
        min: [0, 'Price cannot be negative'],
        validate: {
            validator: Number.isInteger,
            message: 'Price must be a whole number of paise (₹499 → 49900), not rupees or a fraction'
        }
    },
    currency: { type: String, default: 'INR' },
    pricingConfirmedAt: { type: Date },
    author: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    category: {
        type: String,
        required: true,
    },
    subcategory: { type: String },
    topics: {
        type: [String],
        default: [],
        validate: {
            validator: (arr) => arr.length <= 10,
            message: 'A course may declare at most 10 topics',
        },
    },
    level: {
        type: String,
        enum: ['beginner', 'intermediate', 'advanced', 'all'],
        default: 'all',
    },
    language: { type: String, default: 'en' },
    isCertificationPrep: { type: Boolean, default: false },

    learningObjectives: {
        type: [String],
        default: [],
        validate: {
            validator: (arr) => arr.length <= 10 && arr.every((s) => s.length <= 160),
            message: 'At most 10 learning objectives, each at most 160 characters',
        },
    },
    requirements: {
        type: [String],
        default: [],
        validate: { validator: (arr) => arr.length <= 10, message: 'At most 10 requirements' },
    },
    noPrerequisites: { type: Boolean, default: false },
    targetAudience: {
        type: [String],
        default: [],
        validate: { validator: (arr) => arr.length <= 10, message: 'At most 10 target-audience entries' },
    },

    status: {
        type: String,
        enum: COURSE_STATUS_VALUES,
        default: COURSE_STATUS.DRAFT,
    },
    publishedAt: { type: Date },
    // Bumped only by authoring writes (title/description/pricing/curriculum
    // metadata edits) — never by stats or enrollment. Reusing Mongoose's
    // `__v` here would bump on every save, including the ones this field
    // exists to NOT react to, and cause spurious 409s for an instructor
    // mid-edit (D3, C-NFR-5). Concurrency guards must compare-and-increment
    // this field, not `__v`.
    editVersion: { type: Number, default: 0 },
    // Compare-and-increment guard for the curriculum full-tree PUT (D1's
    // ordering rules) — separate from editVersion so a curriculum reorder
    // and a metadata edit don't falsely conflict with each other.
    curriculumVersion: { type: Number, default: 0 },
    // Normalized, denormalized search text (title/subtitle/description/
    // topics lowercased and concatenated) — populated by whichever service
    // writes course metadata; not maintained here via a hook so a partial
    // `$set` update never needs to load-then-recompute the whole document.
    searchText: { type: String },

    rating: {
        type: Number,
        default: 0
    },
    stats: {
        totalDurationSec: { type: Number, default: 0 },
        lectureCount: { type: Number, default: 0 },
        articleCount: { type: Number, default: 0 },
        quizCount: { type: Number, default: 0 },
        resourceCount: { type: Number, default: 0 },
        captionLanguages: { type: [String], default: [] },
        practiceTypes: { type: [String], default: [] },
        ratingAvg: { type: Number, default: 0 },
        ratingCount: { type: Number, default: 0 },
        ratingDistribution: {
            1: { type: Number, default: 0 },
            2: { type: Number, default: 0 },
            3: { type: Number, default: 0 },
            4: { type: Number, default: 0 },
            5: { type: Number, default: 0 },
        },
        enrollmentCount: { type: Number, default: 0 },
    },
    enrolledStudents: [{
        type: Schema.Types.ObjectId,
        ref: 'User'
    }],
    lectures: [{
        type: Schema.Types.ObjectId,
        ref: "Lectures"
    }],
    assignments: [{
        type: Schema.Types.ObjectId,
        ref: "Assignments"
    }],
    modules: [{
        type: Schema.Types.ObjectId,
        ref: 'Sections'
    }]
}, {
    timestamps: true
})

// D3's exact index list. `status` leads all four because every real query is
// "which PUBLISHED courses match X", never "all courses regardless of
// status" — see visibleCourseFilter in course.service.js.
courseSchema.index({ status: 1, publishedAt: 1 });
courseSchema.index({ status: 1, category: 1, subcategory: 1 });
courseSchema.index({ status: 1, 'stats.ratingAvg': 1 });
courseSchema.index({ author: 1, status: 1 });

// No course-delete endpoint exists anywhere in this codebase, so there is
// nothing for a cascade hook to protect yet. The `pre('remove')` hook that
// used to live here was dead code regardless (Mongoose 8 removed document
// `remove()` entirely, so it never fired) and also queried a field
// (`course_id`) that doesn't exist on Modules — see BACKEND_AUDIT.md §2.3.
// If a delete-course feature is added, write its cascade explicitly in the
// controller (the way deleteModule now does), not as a schema hook.

export const Courses = mongoose.model("Courses", courseSchema);
