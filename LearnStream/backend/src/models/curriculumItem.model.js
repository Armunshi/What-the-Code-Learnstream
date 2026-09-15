import mongoose, { Schema } from "mongoose";
import { mediaSchema } from "./schemas/media.schema.js";
import { resourceSchema } from "./schemas/resource.schema.js";

// CurriculumItems (D1, docs/contracts/domain-model.md) — one new collection,
// discriminated on `type`. Every lecture/assignment migrated out of the old
// Lectures/Assignments-linked-to-a-module shape becomes one of these.
//
// 'video-slides' is reserved on the enum below (so a later lane doesn't need
// a schema migration to add it) but deliberately NOT implemented as a
// discriminator here — Deferred per the contract doc.
export const CURRICULUM_ITEM_TYPES = Object.freeze([
  "video",
  "article",
  "assignment",
  "quiz",
  "resource",
  // "video-slides" — reserved, deferred. Do not implement.
]);

const baseOptions = {
  discriminatorKey: "type",
  timestamps: true,
};

// `type` is deliberately NOT declared as a field below even though it's a
// real, queried column — it's the discriminatorKey (baseOptions above), and
// Mongoose already adds that path to the schema automatically. Redeclaring
// it manually alongside `discriminatorKey: "type"` puts two competing
// definitions of the same path in play: a write through the base
// CurriculumItems model (as opposed to a specific discriminator model like
// VideoItem) silently drops the field entirely instead of casting or
// validating it — confirmed by a $setOnInsert of `type: "video"` via the
// base model never actually landing in the stored document. Discriminator
// models (VideoItem.create()/.findOneAndUpdate(), etc.) set it correctly on
// their own by merging it into every filter and insert; anywhere generic
// code needs to filter or read it, `type` is a plain string on the stored
// document regardless of how it got there.
const curriculumItemSchema = new Schema(
  {
    course: { type: Schema.Types.ObjectId, ref: "Courses", required: true },
    section: { type: Schema.Types.ObjectId, ref: "Sections", required: true },
    title: { type: String, required: true, maxlength: 80 },
    description: { type: String },
    order: { type: Number, required: true, default: 0 },
    isFreePreview: { type: Boolean, default: false },
    durationSec: { type: Number, default: 0 },
    resources: { type: [resourceSchema], default: [] },
    // Bumped only by authoring writes to this item — never by stats or
    // enrollment writers (D3's editVersion rule applies at the item level
    // too, for the same reason: a stats recompute must never trip a
    // concurrent-edit conflict for an instructor mid-edit).
    editVersion: { type: Number, default: 0 },
  },
  baseOptions
);

curriculumItemSchema.index({ section: 1, order: 1 });
curriculumItemSchema.index({ course: 1, type: 1 });

export const CurriculumItems = mongoose.model("CurriculumItems", curriculumItemSchema);

// --- Discriminators -------------------------------------------------------

export const VideoItem = CurriculumItems.discriminator(
  "video",
  new Schema({ media: { type: mediaSchema, default: () => ({}) } })
);

export const ArticleItem = CurriculumItems.discriminator(
  "article",
  new Schema({
    body: { type: String, maxlength: 50_000 },
    readingTimeSec: { type: Number },
  })
);

export const AssignmentItem = CurriculumItems.discriminator(
  "assignment",
  new Schema({
    assignment: { type: Schema.Types.ObjectId, ref: "Assignments" },
  })
);

export const QuizItem = CurriculumItems.discriminator(
  "quiz",
  new Schema({
    quiz: { type: Schema.Types.ObjectId, ref: "Quizzes" },
    quizKind: { type: String, enum: ["quiz", "practice_test"], default: "quiz" },
  })
);

export const ResourceItem = CurriculumItems.discriminator(
  "resource",
  new Schema({ file: { type: resourceSchema, default: undefined } })
);

// 'video-slides' discriminator intentionally not registered — see
// CURRICULUM_ITEM_TYPES above.
