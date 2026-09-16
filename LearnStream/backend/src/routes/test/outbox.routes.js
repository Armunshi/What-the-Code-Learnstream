import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { getOutboxMessages } from "../../services/mail.service.js";

// e2e-only: lets the Playwright harness read back the OTP mail.service.js
// "sent" instead of needing a real inbox. Mounted only behind
// E2E_TEST_ROUTES=1 && !isProduction (app.js's mountTestRoutes gate,
// docs/contracts/api-conventions.md "Route mounting") — never a production
// code path. mail.service.js's own outbox array is additionally gated on
// E2E_MAIL_OUTBOX=1, so this route exists without necessarily having
// anything in it unless that flag is also set.
const router = Router();

router.get(
  "/outbox",
  asyncHandler(async (req, res) => {
    const email = req.query.email;
    if (!email || typeof email !== "string") {
      throw new ApiError(400, "email query parameter is required");
    }
    const messages = getOutboxMessages(email);
    return res.status(200).json(new ApiResponse(200, messages, "Outbox messages"));
  })
);

export default { basePath: "/__test__", priority: 100, router };
