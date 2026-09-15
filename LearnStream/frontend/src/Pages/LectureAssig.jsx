import { Navigate, useParams } from "react-router-dom";

// app/router.jsx (frozen after Wave 0) still routes the legacy
// "student/:user_id/:course_id/:module_id/view" path to this component —
// per this lane's own brief ("Redirect student/:user_id/:course_id/:module_id/view
// and student/:user_id"), its job is to redirect, not render, once the real
// player exists. `:module_id` here has always actually held a lecture id
// (the old naming predates the section/curriculum-item split) — the D1
// migration preserves every lecture's original `_id` as its new
// CurriculumItem `_id`, so it maps directly onto the new route with no
// lookup needed.
//
// The component this file used to be (a ReactPlayer-based player reading
// course_id/lectures/assignments from router `location.state`) only ever
// worked when ViewStudentModule.jsx's module/lecture list linked here with
// that state attached. CAT turned that page into a redirect to
// /course/:courseId (plan §0.2), which removed the only real entry point
// into this one — so by the time this lane's own click-handler fix landed,
// nothing in the app could actually navigate here with the state it needs.
// The real fix is this redirect, not preserving a page nothing can reach.
export function LectureAssig() {
  const { course_id: courseId, module_id: itemId } = useParams();
  return <Navigate to={`/learn/${courseId}/items/${itemId}`} replace />;
}

export default LectureAssig;
