import { ApiError } from "../utils/ApiError.js";

// Declarative schemas (BACKEND_AUDIT.md §3.4) instead of ad hoc field checks
// spread across controllers — a schema also catches format/strength issues
// (a malformed email, a short password) that a bare truthiness check never
// could, and rejects with a clean 400 before a Mongoose ValidationError would
// otherwise surface as an opaque 500 (§2.1).
export const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const errors = result.error.issues.map((issue) => ({
      field: issue.path.join(".") || "(body)",
      message: issue.message,
    }));
    return next(new ApiError(400, errors[0].message, errors));
  }
  req.body = result.data;
  next();
};
