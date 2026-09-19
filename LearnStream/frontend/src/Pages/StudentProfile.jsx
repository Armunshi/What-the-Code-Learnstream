import { Navigate } from "react-router-dom";

// The route tree in app/router.jsx (frozen) still points
// "student/:user_id/profile" directly at this component rather than through
// LegacyUserRoute (which has no `to` mapping wired up either) — router.jsx
// isn't in docs/lanes/acc.json's owns list, so this file itself is the only
// place this lane can make the old profile route redirect, per the plan's
// "Old profile routes redirect" requirement.
export default function StudentProfile() {
  return <Navigate to="/account/profile" replace />;
}
