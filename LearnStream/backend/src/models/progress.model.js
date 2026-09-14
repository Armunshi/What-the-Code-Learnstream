import mongoose,{Schema} from "mongoose";
const completedLectureSchema = new Schema({
    lectureId: {
        type: Schema.Types.ObjectId,
        ref: 'Lectures',
        required: true
    },
    completedAt: {
        type: Date,
        default: Date.now
    }
});
const completedAssignmentSchema = new Schema({
    assignmentId:{
        type:Schema.Types.ObjectId,
        ref:'Assignments',
        required:true
    },
    completedAt:{
        type:Date,
        default:Date.now
    }
})
const ProgressSchema = new Schema({
    studentId:{
        type:Schema.Types.ObjectId,
        ref: 'User'
    },
    courseId:{
            type:Schema.Types.ObjectId,
        ref:'Courses'
    },
    completedLectures:[completedLectureSchema],
    completedAssignments:[completedAssignmentSchema],
    completedLectureCount: {
        type: Number,
        default: 0
    },
    lastUpdated: {
        type: Date,
        default: Date.now
    },
    // Progress v2 (D5, plan §3): shape only — the learn service that writes
    // through these is a later lane's job (LEARN, Wave 1). Added now so
    // migrations and any Wave 1 lane reading this model don't need a schema
    // change. `completedItems` references CurriculumItems, not the legacy
    // Lectures/Assignments collections `completedLectures`/
    // `completedAssignments` point at.
    completedItems: [{
        type: Schema.Types.ObjectId,
        ref: 'CurriculumItems',
    }],
    lastItemId: {
        type: Schema.Types.ObjectId,
        ref: 'CurriculumItems',
    },
    lastAccessedAt: { type: Date },
    // Percent over "countable" item types only (video, article, quiz,
    // assignment) — resource items don't count toward completion.
    percentComplete: { type: Number, default: 0 },
    completedAt: { type: Date },
},{
    timestamps:true
})
ProgressSchema.index({ studentId: 1, courseId: 1 }, { unique: true });

const Progress = mongoose.model('Progress',ProgressSchema);

export {Progress}