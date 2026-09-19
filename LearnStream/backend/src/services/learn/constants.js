// D5 (docs/contracts/domain-model.md): "Countable types are video, article,
// quiz and assignment." `resource` items can still be marked complete (a
// learner can tick one off), but never count toward percentComplete — that
// mirrors curriculumStats keeping resourceCount separate from
// lectureCount/articleCount/quizCount.
export const COUNTABLE_ITEM_TYPES = Object.freeze(["video", "article", "quiz", "assignment"]);
