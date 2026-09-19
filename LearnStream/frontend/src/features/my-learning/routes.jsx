import RequireRole from "@/app/guards/RequireRole";
import { MyLearningPage } from "./MyLearningPage";

export default [
  {
    path: "my-learning",
    element: <RequireRole roles="student" />,
    children: [{ index: true, element: <MyLearningPage /> }],
  },
];
