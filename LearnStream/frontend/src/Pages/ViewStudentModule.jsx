import { Navigate, useParams } from 'react-router-dom';

// app/UserOrCourseRoute.jsx routes here for a 24-hex value at /user/:param —
// per plan §0.2 ("Route collision: /user/:id"), the course page itself has
// moved to /course/:courseId (features/course/routes.jsx), so this
// component's whole job now is to redirect there. (This component's own
// comment used to say no hex-id-vs-username branch was needed here, on the
// theory that this route never held a real profile — true until ACC's
// PublicProfilePage actually landed at the same path shape; the branch now
// lives in UserOrCourseRoute instead of duplicated in every consumer.)
export function ViewStudentModule() {
  const { idOrUsername: courseId } = useParams();
  return <Navigate to={`/course/${courseId}`} replace />;
}

export default ViewStudentModule;
