import { Schema } from "mongoose";

// MediaSchema (docs/contracts/domain-model.md D1). Embedded wherever a
// document needs "one piece of processed media" — a video CurriculumItem's
// `media`, and a course's `promoVideo` (D3). `status` is persisted on the
// item itself (not derived) so it survives a page refresh mid-upload.
export const MEDIA_PROVIDERS = Object.freeze(["cloudinary", "fake"]);
export const MEDIA_STATUS = Object.freeze({
  NONE: "NONE",
  UPLOADING: "UPLOADING",
  PROCESSING: "PROCESSING",
  READY: "READY",
  FAILED: "FAILED",
});
export const MEDIA_STATUS_VALUES = Object.values(MEDIA_STATUS);

const captionSchema = new Schema(
  {
    lang: { type: String, required: true },
    label: { type: String, required: true },
    url: { type: String },
    publicId: { type: String },
    isDefault: { type: Boolean, default: false },
  },
  { _id: true }
);

export const mediaSchema = new Schema(
  {
    // Source
    provider: { type: String, enum: MEDIA_PROVIDERS, default: "cloudinary" },
    publicId: { type: String },

    // Status
    status: { type: String, enum: MEDIA_STATUS_VALUES, default: MEDIA_STATUS.NONE },
    statusChangedAt: { type: Date },
    error: {
      code: { type: String },
      message: { type: String },
    },

    // File metadata
    durationSec: { type: Number },
    bytes: { type: Number },
    width: { type: Number },
    height: { type: Number },

    // Delivery
    mp4Url: { type: String },
    hlsUrl: { type: String },
    posterUrl: { type: String },

    // Captions
    captions: { type: [captionSchema], default: [] },
    transcriptText: { type: String },
  },
  { _id: false }
);
