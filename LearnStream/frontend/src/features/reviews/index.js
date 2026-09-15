// Public API surface of the reviews feature (docs/lanes/rev.json owns
// features/reviews/**). W0-A creates this barrel with placeholder bodies for
// the three frozen stubs assigned to REV (docs/contracts/stubs.md). REV
// replaces only these bodies in Wave 1 — the signatures are frozen.

// CourseRatingHeaderMetric({courseId, stats}) — compact header form, e.g.
// "4.7 ★ (3,779 ratings) 56,145 students" (FR-REV-1.1).
export function CourseRatingHeaderMetric({ courseId, stats }) {
  void courseId;
  void stats;
  return null;
}

// CourseReviewsSection({courseId}) — full section: header, RatingDistribution,
// ReviewGrid, HelpfulVote, "Show more reviews", ReviewForm.
export function CourseReviewsSection({ courseId }) {
  void courseId;
  return null;
}

// HomeSocialProof — wraps TestimonialCarousel, StatsStrip, TrustBar for the
// homepage.
export function HomeSocialProof() {
  return null;
}
