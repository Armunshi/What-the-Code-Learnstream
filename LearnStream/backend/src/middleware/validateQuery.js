import { ApiError } from "../utils/ApiError.js";

// Query-string sibling of middleware/validate.js. Separate from it because
// req.query and req.body have different shapes to validate against (every
// query value starts life as a string, so schemas passed here should coerce
// — e.g. z.coerce.number() — rather than expect real numbers/booleans) and
// a validated query is assigned back onto req.query rather than req.body.
export const validateQuery = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.query);
  if (!result.success) {
    const errors = result.error.issues.map((issue) => ({
      field: issue.path.join(".") || "(query)",
      code: issue.code,
    }));
    return next(new ApiError(400, "Invalid query parameters", errors));
  }
  req.query = result.data;
  next();
};
