import { Navigate } from 'react-router-dom';

// Replaced by MyCoursesPage (frontend/src/features/instructor-course/pages/
// MyCoursesPage.jsx) at /instructor/courses (plan W1-SHELL). app/router.jsx's
// `teacher/:user_id` route wraps this component in LegacyUserRoute, but that
// only redirects once a `to` mapping is supplied there — and router.jsx is a
// frozen collector file this lane doesn't touch. Redirecting from inside the
// component body instead (a file this lane does own) gets the same result.
export function TeachersPage() {
  return <Navigate to="/instructor/courses" replace />;
}

export default TeachersPage;
