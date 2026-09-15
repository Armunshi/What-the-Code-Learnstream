import { Navigate } from 'react-router-dom';

// Replaced by CreateCoursePage (frontend/src/features/instructor-course/
// pages/CreateCoursePage.jsx) at /instructor/courses/new (plan W1-SHELL).
// See TeachersPage.jsx for why the redirect lives in the component body
// rather than in app/router.jsx (a frozen collector file this lane doesn't
// touch) — `teacher/:user_id/makecourse` isn't even wrapped in
// LegacyUserRoute today, so this is the only place that redirect can live.
export function MakeaCourse() {
  return <Navigate to="/instructor/courses/new" replace />;
}

export default MakeaCourse;
