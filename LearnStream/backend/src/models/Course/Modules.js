import mongoose from 'mongoose';
const { Schema } = mongoose;

const moduleSchema = new Schema({
    title: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: false // Optional module description
    },
    course: {
        type: Schema.Types.ObjectId,
        ref: 'Courses',
        required: true
    },
    lectures: [{
        type: Schema.Types.ObjectId,
        ref: 'Lectures'
    }],
    assignments: [{
        type: Schema.Types.ObjectId,
        ref: 'Assignments'
    }]
}, {
    timestamps: true
});
// This used to carry a `pre('remove')` cascade-delete hook, but document
// `remove()` was removed entirely in Mongoose 8 — the hook never fired.
// deleteModule (Modules.controller.js) now does this cascade explicitly
// instead (BACKEND_AUDIT.md §2.3).

const Modules = mongoose.model('Modules', moduleSchema);

export { Modules };
