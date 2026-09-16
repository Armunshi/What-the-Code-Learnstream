import { useParams } from 'react-router-dom';
import { ViewStudentModule } from '../Pages/ViewStudentModule.jsx';
import { PublicProfilePage } from '../features/profile/PublicProfilePage.jsx';

// /user/:idOrUsername is the plan's own acknowledged route collision (§0.2):
// the legacy course-module-view redirect (CAT) and ACC's public profile page
// both want this exact path shape, and React Router can't mount two routes
// at the same literal path — whichever is declared first always wins, which
// silently made PublicProfilePage unreachable once ACC added its own
// /user/:username entry alongside the pre-existing /user/:course_id one.
//
// Usernames are validated to never be a 24-hex string specifically so this
// branch can tell the two apart reliably (domain-model.md's user.model.js
// note) — every value this route has ever seen as a course id already is
// one, so the match is unambiguous in both directions.
const HEX24 = /^[0-9a-f]{24}$/i;

export function UserOrCourseRoute() {
  const { idOrUsername } = useParams();
  return HEX24.test(idOrUsername ?? '') ? <ViewStudentModule /> : <PublicProfilePage />;
}

export default UserOrCourseRoute;
