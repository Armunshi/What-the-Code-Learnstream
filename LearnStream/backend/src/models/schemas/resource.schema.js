import { Schema } from "mongoose";

// ResourceSchema — not fully spelled out in domain-model.md beyond "embedded
// in items"; kept minimal on purpose (docs/contracts/domain-model.md D1's
// CurriculumItems.resources and the `resource` discriminator's `file`).
export const resourceSchema = new Schema(
  {
    url: { type: String },
    publicId: { type: String },
    filename: { type: String },
    sizeBytes: { type: Number },
    mimeType: { type: String },
  },
  { _id: true }
);
