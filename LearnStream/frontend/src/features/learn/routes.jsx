import RequireAuth from "@/app/guards/RequireAuth";
import { LearnLayout } from "./LearnLayout";

// Feature routes registry entry (docs/contracts/registries.md), collected
// by app/router.jsx's import.meta.glob — never edited there directly.
// Entitlement itself (owner-or-enrolled-student) is enforced server-side by
// GET /learn/:courseId; RequireAuth here only keeps a signed-out visitor
// from reaching the page at all.
export default [
  {
    path: "learn/:courseId",
    element: <RequireAuth />,
    children: [
      { index: true, element: <LearnLayout /> },
      { path: "items/:itemId", element: <LearnLayout /> },
    ],
  },
];
