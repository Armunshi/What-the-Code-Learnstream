import mongoose, { Schema } from 'mongoose'

const courseSchema = new Schema({
    thumbnail: {
        type: String,
        required: true
    },
    isLive: {
        type: Boolean,
        default: false,
    },
    title: {
        type: String,
        required: true
    },
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
    author: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    category: {
        type: String,
        required: true,
    },
    rating: {
        type: Number,
        default: 0
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
        ref: 'Modules'
    }]
}, {
    timestamps: true
})

// No course-delete endpoint exists anywhere in this codebase, so there is
// nothing for a cascade hook to protect yet. The `pre('remove')` hook that
// used to live here was dead code regardless (Mongoose 8 removed document
// `remove()` entirely, so it never fired) and also queried a field
// (`course_id`) that doesn't exist on Modules — see BACKEND_AUDIT.md §2.3.
// If a delete-course feature is added, write its cascade explicitly in the
// controller (the way deleteModule now does), not as a schema hook.

export const Courses = mongoose.model("Courses", courseSchema);
