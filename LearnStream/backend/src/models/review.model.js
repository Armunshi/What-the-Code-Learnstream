import mongoose, { Schema } from "mongoose";

// D7 (docs/contracts/domain-model.md): rating is 1.0-5.0 in 0.5 steps,
// validated as `Number.isInteger(v * 2)` rather than a fixed enum of
// allowed values — that check is exactly "a multiple of 0.5" without
// hardcoding the nine legal values twice.
const isHalfStep = (value) => Number.isInteger(value * 2);

const reviewSchema = new Schema(
    {
        course: {
            type: Schema.Types.ObjectId,
            ref: "Courses",
            required: true,
        },
        user: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        rating: {
            type: Number,
            required: true,
            min: 1,
            max: 5,
            validate: {
                validator: isHalfStep,
                message: "Rating must be in 0.5 steps between 1 and 5",
            },
        },
        comment: {
            type: String,
            default: "",
            maxlength: 2000,
        },
        // Denormalized onto the review document itself (not course.stats —
        // these belong to one review, not the course aggregate) so a review
        // list page can render vote counts with no extra query per card.
        // Written only by services/reviews/voteStats.js's recount, never
        // incremented in place (D7: "counts are recomputed with
        // countDocuments, never incremented, so they can't drift").
        helpfulCount: { type: Number, default: 0 },
        unhelpfulCount: { type: Number, default: 0 },
    },
    { timestamps: true }
);

// A student may review a course once — enforced here, not just in the
// controller, so a race between two concurrent POSTs can't both succeed.
// The create endpoint translates the resulting E11000 into 409 (dto.md /
// plan §W1-REV: "a duplicate review 409").
reviewSchema.index({ course: 1, user: 1 }, { unique: true });
// Course review list, paginated by recency or helpfulness (dto.md sort=recent|helpful).
reviewSchema.index({ course: 1, createdAt: -1 });
reviewSchema.index({ course: 1, helpfulCount: -1 });

export const Review = mongoose.model("Review", reviewSchema);
