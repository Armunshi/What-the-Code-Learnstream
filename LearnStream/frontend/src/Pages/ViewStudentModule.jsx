import { Navigate, useParams } from 'react-router-dom';

// app/router.jsx (frozen after Wave 0) still routes the legacy "user/:course_id"
// path to this component — that file's own route-table comment explains why
// this can't just be deleted from there. Per plan §0.2 ("Route collision:
// /user/:id"), the course page itself has moved to /course/:courseId
// (features/course/routes.jsx), so this component's whole job now is to
// redirect there. This route never held a real user profile (unlike
// teacher/:user_id / student/:user_id, which ACC's PublicProfilePage will
// eventually take over at /user/:username), so — unlike those two — there is
// no hex-id-vs-username branch to make: every value this route has ever seen
// in `course_id` is a course id.
export function ViewStudentModule() {
  const { course_id: courseId } = useParams();
  return <Navigate to={`/course/${courseId}`} replace />;
}

export default ViewStudentModule;
