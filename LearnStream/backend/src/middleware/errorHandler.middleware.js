import mongoose from "mongoose";
import multer from "multer";
import { ApiError } from "../utils/ApiError.js";
import { env } from "../config/env.js";

// Registered last in app.js. Serializes every error — ApiError or not — to the
// same {statusCode, data, message, success} envelope ApiResponse uses, instead
// of Express's default HTML-with-stack-trace handler (BACKEND_AUDIT.md §2.1).
const errorHandler = (err, req, res, next) => {
    let error = err;

    if (!(error instanceof ApiError)) {
        let statusCode = error.statusCode || 500;
        let message = error.message || "Something went wrong";

        if (error instanceof mongoose.Error.ValidationError || error instanceof mongoose.Error.CastError) {
            statusCode = 400;
            message = error.message;
        } else if (error instanceof multer.MulterError) {
            statusCode = 400;
            message = error.message;
        }

        error = new ApiError(statusCode, message, error?.errors || [], err.stack);
    }

    const response = {
        statusCode: error.statusCode,
        data: error.data,
        message: error.message,
        success: error.success,
        errors: error.errors,
    };

    if (!env.isProduction) {
        response.stack = error.stack;
    }

    return res.status(error.statusCode).json(response);
};

export { errorHandler };
