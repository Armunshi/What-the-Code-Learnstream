import { Navigate } from "react-router-dom";

// See StudentProfile.jsx for why this is a redirect component rather than a
// route-table edit: "teacher/:user_id/profile" in app/router.jsx (frozen)
// still points straight at this file, not through LegacyUserRoute.
export default function TeacherProfile() {
  return <Navigate to="/account/profile" replace />;
}
