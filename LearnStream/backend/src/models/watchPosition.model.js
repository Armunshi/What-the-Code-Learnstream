import mongoose, { Schema } from "mongoose";

// WatchPosition (D5, docs/contracts/domain-model.md — "Player and progress").
// One document per (student, item): the player's resume point plus enough
// state to cap a heartbeat's reported delta against real wall-clock time.
//
// Deliberately separate from Progress (which only ever records COMPLETION —
// completedItems/percentComplete/lastItemId): a heartbeat fires every 15s
// during normal playback, and giving it its own collection means that write
// volume never has any chance of touching the fields markItemComplete owns.
const watchPositionSchema = new Schema(
    {
        student: { type: Schema.Types.ObjectId, ref: "User", required: true },
        course: { type: Schema.Types.ObjectId, ref: "Courses", required: true },
        item: { type: Schema.Types.ObjectId, ref: "CurriculumItems", required: true },
        // Last known playhead, for resume.
        positionSec: { type: Number, default: 0 },
        // Cumulative watched seconds, server-capped on every write — this is
        // what the 90%-completion rule (L-FR-4.1) compares against
        // durationSec, never positionSec (which a seek can move for free).
        watchedSec: { type: Number, default: 0 },
        playbackRate: { type: Number, default: 1 },
        // The baseline a heartbeat's watchedDeltaSec is capped against:
        // elapsed wall-clock time (now - lastHeartbeatAt) x playbackRate.
        lastHeartbeatAt: { type: Date, default: Date.now },
    },
    { timestamps: true }
);

// One position per student per item — every write is an upsert against this.
watchPositionSchema.index({ student: 1, item: 1 }, { unique: true });
watchPositionSchema.index({ student: 1, course: 1 });

export const WatchPosition = mongoose.model("WatchPosition", watchPositionSchema);
