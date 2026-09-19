import mongoose, { Schema } from "mongoose";

// Sections (D1, docs/contracts/domain-model.md). Deliberately bound to the
// EXISTING `modules` collection — `mongoose.model('Sections', schema,
// 'modules')` — rather than a new collection, so migrate-w0-curriculum-v2.js
// can add fields to the documents already there instead of copying them
// somewhere new and needing to keep two collections in sync. module.model.js
// becomes a re-export shim pointing here (until W4 deletes it).
//
// The API and UI say "section" everywhere (C-UI-4) — this schema, and every
// new adapter that touches it, never uses the word "module".
const sectionSchema = new Schema(
  {
    course: { type: Schema.Types.ObjectId, ref: "Courses", required: true },
    title: { type: String, required: true, maxlength: 80 },
    learningObjective: { type: String, maxlength: 200 },
    description: { type: String },
    order: { type: Number, required: true, default: 0 },

    // Legacy fields carried over from the `modules` collection so the
    // pre-migration adapters (module/lecture/bulk-module/assignment
    // services) keep working against documents that haven't been through
    // migrate-w0-curriculum-v2.js yet, and so the migration itself has
    // something to read. Not part of the D1 contract shape — do not add new
    // readers of these two outside the adapter layer; new code should read
    // CurriculumItems instead.
    lectures: [{ type: Schema.Types.ObjectId, ref: "Lectures" }],
    assignments: [{ type: Schema.Types.ObjectId, ref: "Assignments" }],
  },
  { timestamps: true }
);

sectionSchema.index({ course: 1, order: 1 });

export const Sections = mongoose.model("Sections", sectionSchema, "modules");
