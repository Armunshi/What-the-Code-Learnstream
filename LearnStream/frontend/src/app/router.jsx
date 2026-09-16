import { Route, createBrowserRouter, createRoutesFromElements } from 'react-router-dom';
import Layout from '../Layout.jsx';
import RootLayout from './layouts/RootLayout.jsx';
import RouteError from './RouteError.jsx';
import LegacyUserRoute from './LegacyUserRoute.jsx';

import LoginS from '../Pages/Login-students.jsx';
import LoginT from '../Pages/Login-teacher.jsx';
import SignupS from '../Pages/Signup-students.jsx';
import SignupT from '../Pages/Signup-Teacher.jsx';
import Teachers from '../Pages/TeachersPage.jsx';
import Student from '../Pages/StudentPage.jsx';
import Home from '../Pages/Home.jsx';
import MakeaCourse from '../Pages/MakeaCourse.jsx';
import ViewtheModules from '../Pages/ViewtheModules.jsx';
import LectureAssig from '../Pages/LectureAssig.jsx';
import UploadedAssignment from '../Pages/UploadedAssignment.jsx';
import LoginPage from '../Pages/login.jsx';
import Cart from '../Pages/Cart.jsx';
import About from '../Pages/About.jsx';
import Services from '../Pages/Services.jsx';
import Pricing from '../Pages/Pricing.jsx';
import Contact from '../Pages/Contact.jsx';
import StudentProfile from '../Pages/StudentProfile.jsx';
import TeacherProfile from '../Pages/TeacherProfile.jsx';

// The legacy route tree, moved here unchanged from the old main.jsx (which
// used to build the router inline). Every one of these paths keeps working
// exactly as before — nothing here is allowed to 404 just because the app
// shell moved. Two of the old :user_id routes are wrapped in
// LegacyUserRoute so the redirect shape exists for whichever lane later
// gives them a new home (docs/contracts registries.md); it is a no-op today
// since no `to` mapping is supplied yet.
//
// The old "user/:course_id" entry (ViewStudentModule) is NOT here — it
// collided with ACC's "user/:username" (PublicProfilePage) at the identical
// path shape, since createBrowserRouter resolves same-specificity siblings
// by array order and this array is spread before featureRoutes below, so
// it always won and made PublicProfilePage unreachable. Both now live behind
// one entry, features/profile/routes.jsx's "user/:idOrUsername", which
// branches on the value (app/UserOrCourseRoute.jsx) instead of colliding.
const legacyRoutes = createRoutesFromElements(
  <Route path="/" element={<Layout />}>
    <Route path="/" element={<Home />} />
    <Route path="login" element={<LoginPage />} />
    <Route path="login/student" element={<LoginS />} />
    <Route path="login/teacher" element={<LoginT />} />
    <Route path="signup/student" element={<SignupS />} />
    <Route path="signup/teacher" element={<SignupT />} />
    <Route path="about" element={<About />} />
    <Route path="services" element={<Services />} />
    <Route path="pricing" element={<Pricing />} />
    <Route path="contact" element={<Contact />} />
    <Route path="teacher/:user_id/profile" element={<TeacherProfile />} />
    <Route
      path="teacher/:user_id"
      element={
        <LegacyUserRoute>
          <Teachers />
        </LegacyUserRoute>
      }
    />
    <Route path="teacher/:user_id/makecourse" element={<MakeaCourse />} />
    <Route path="teacher/:user_id/:course_id" element={<ViewtheModules />} />
    <Route path="teacher/:user_id/:course_id/:assignmentId" element={<UploadedAssignment />} />
    <Route path="student/:user_id/Cart" element={<Cart />} />
    <Route path="student/:user_id/:course_id/:module_id/view" element={<LectureAssig />} />
    <Route path="student/:user_id/profile" element={<StudentProfile />} />
    <Route
      path="student/:user_id"
      element={
        <LegacyUserRoute>
          <Student />
        </LegacyUserRoute>
      }
    />
    <Route path="cart/" element={<Cart />} />
  </Route>
);

// Registry: features/*/routes.jsx export a default array of React Router
// route objects (docs/contracts/registries.md). Collected here via
// import.meta.glob and never edited again to "hook up" a feature — lanes
// only ever add a new features/<feature>/routes.jsx file. No feature has
// added one yet in Wave 0, so this is an empty array today; it composes
// automatically as Wave 1 lanes land theirs.
const featureRouteModules = import.meta.glob('../features/*/routes.jsx', { eager: true });
const featureRoutes = Object.values(featureRouteModules)
  .map((mod) => mod.default)
  .filter(Boolean)
  .flat();

export const router = createBrowserRouter([
  ...legacyRoutes,
  {
    element: <RootLayout />,
    errorElement: <RouteError />,
    children: featureRoutes,
  },
]);

export default router;
