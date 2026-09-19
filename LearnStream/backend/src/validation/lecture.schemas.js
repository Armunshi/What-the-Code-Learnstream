import { z } from "zod";

export const askLectureSchema = z.object({
    question: z
        .string()
        .trim()
        .min(3, "Question must be at least 3 characters")
        .max(500, "Question must be at most 500 characters"),
});
