import { UserOrCourseRoute } from '@/app/UserOrCourseRoute.jsx';

// "user/:username" collided with the legacy "user/:course_id" course-view
// route at the identical path shape (plan §0.2) — router.jsx's own comment
// explains why the legacy route was removed in favor of this one instead.
// UserOrCourseRoute branches to PublicProfilePage or the legacy redirect
// depending on whether the value is a 24-hex ObjectId.
export default [{ path: 'user/:idOrUsername', element: <UserOrCourseRoute /> }];
