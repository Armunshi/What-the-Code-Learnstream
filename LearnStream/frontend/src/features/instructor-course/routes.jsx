import { RequireTeacher } from './components/RequireTeacher';
import { CourseAuthoringLayout } from './components/CourseAuthoringLayout';
import { MyCoursesPage } from './pages/MyCoursesPage';
import { CreateCoursePage } from './pages/CreateCoursePage';
import { stepRegistry } from './steps/registry';

// Every registered step becomes a route nested under
// /instructor/courses/:courseId, resolved via React Router v7's own `lazy`
// route field (see steps/registry.js's doc comment on step.jsx's `lazy`).
const stepRoutes = stepRegistry.map((step) => ({
  path: step.path,
  lazy: async () => {
    const mod = await step.lazy();
    return { Component: mod.default };
  },
}));

// Feature route registry entry (docs/contracts/registries.md) — collected
// by app/router.jsx's import.meta.glob, never wired up by hand there.
// docs/contracts/api-conventions.md's route table: /instructor/courses,
// /instructor/courses/new, /instructor/courses/:courseId/{plan,content,publish,review}/….
export default [
  {
    path: 'instructor/courses',
    element: <RequireTeacher />,
    children: [
      { index: true, element: <MyCoursesPage /> },
      { path: 'new', element: <CreateCoursePage /> },
      {
        path: ':courseId',
        element: <CourseAuthoringLayout />,
        children: stepRoutes,
      },
    ],
  },
];
