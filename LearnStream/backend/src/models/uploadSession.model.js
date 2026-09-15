import mongoose, { Schema } from "mongoose";
import { UPLOAD_KINDS } from "../config/uploadPolicy.js";

// UploadSession — the server's own record of "what did we sign, and did the
// browser ever tell us it finished" (D4, docs/contracts/domain-model.md).
// Created by POST /instructor/uploads/sign, consumed by /complete, /fail,
// and the media-status reconcile poll.
//
// It exists for two reasons /complete can't do without: (1) the server must
// know the exact publicId/resourceType it signed, so it can reject a
// /complete call claiming a different asset (never trust the client — D4
// step 3) instead of writing whatever publicId the request body says; and
// (2) a video replace must delete the OLD asset only after the NEW one is
// READY (D4 step 5), which can be several seconds (webhook) or up to the
// reconcile poll's next tick after /complete returns — `pendingDeletePublicId`
// is what carries that intent across that gap.
export const UPLOAD_SESSION_STATUS = Object.freeze({
  PENDING: "PENDING",
  COMPLETE: "COMPLETE",
  FAILED: "FAILED",
});

const uploadSessionSchema = new Schema(
  {
    course: { type: Schema.Types.ObjectId, ref: "Courses", required: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    target: {
      kind: { type: String, enum: UPLOAD_KINDS, required: true },
      // CurriculumItem id (item-video/item-caption/item-resource) or
      // Assignment id (assignment-file). Absent for course-thumbnail and
      // course-promo, whose target is the course itself.
      itemId: { type: Schema.Types.ObjectId },
      // item-caption only — BCP-47-ish language tag for the caption track.
      lang: { type: String },
    },
    provider: { type: String, enum: ["cloudinary", "fake"], required: true },
    resourceType: { type: String, enum: ["video", "image", "raw"], required: true },
    publicId: { type: String, required: true, unique: true },
    file: {
      name: { type: String, required: true },
      size: { type: Number, required: true },
      mime: { type: String, required: true },
    },
    status: {
      type: String,
      enum: Object.values(UPLOAD_SESSION_STATUS),
      default: UPLOAD_SESSION_STATUS.PENDING,
    },
    error: {
      code: { type: String },
      message: { type: String },
    },
    // Set by /complete when this upload replaces an existing asset on the
    // target and the new asset is still PROCESSING (async/video kinds) —
    // cleared, and the old asset actually removed, once the webhook or the
    // reconcile poll observes the new asset READY.
    pendingDeletePublicId: { type: String },
    pendingDeleteResourceType: { type: String, enum: ["video", "image", "raw"] },
  },
  { timestamps: true }
);

uploadSessionSchema.index({ course: 1, "target.itemId": 1 });
// TTL 7 days (docs/lanes/upl.json note) — an upload session is scratch state
// for one authoring action, not a durable record; the durable outcome lives
// on the course/curriculum-item/assignment document itself.
uploadSessionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

export const UploadSessions = mongoose.model("UploadSessions", uploadSessionSchema);
