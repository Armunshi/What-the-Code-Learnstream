import { Router } from "express";
import multer from "multer";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import {
  beginFakeUpload,
  getFakeUpload,
  receiveFakeChunk,
  finalizeFakeAsset,
} from "../../services/media/providers/fakeStore.js";

// Stands in for Cloudinary's own chunked-upload HTTP endpoint when
// MEDIA_PROVIDER=fake (D4 step 6). Mounted only behind E2E_TEST_ROUTES
// (loadFeatureRoutes.js's mountTestRoutes, gated in app.js), so this never
// exists in production regardless of MEDIA_PROVIDER.
//
// The request shape mirrors Cloudinary's real chunked-upload contract on
// purpose — X-Unique-Upload-Id identifying one file across all its chunks,
// Content-Range naming this chunk's byte range, and the signed fields
// (here just public_id/eager_async — providers/fake.js's sign() output)
// sent as multipart form fields alongside the chunk — so
// frontend/chunkedUpload.js needs zero provider-specific branching: it
// always POSTs the same shape to whatever uploadUrl sign() returned.
const upload = multer({ storage: multer.memoryStorage() });

const router = Router();

const CONTENT_RANGE_RE = /^bytes (\d+)-(\d+)\/(\d+)$/;

router.post(
  "/upload/:resourceType",
  upload.single("file"),
  asyncHandler(async (req, res) => {
    const uploadId = req.header("X-Unique-Upload-Id");
    if (!uploadId) {
      throw new ApiError(400, "X-Unique-Upload-Id header is required");
    }

    const contentRange = req.header("Content-Range");
    const match = contentRange && CONTENT_RANGE_RE.exec(contentRange);
    if (!match) {
      throw new ApiError(400, "Content-Range header must look like 'bytes <start>-<end>/<total>'");
    }
    const [, startStr, endStr, totalStr] = match;
    const start = Number(startStr);
    const end = Number(endStr);
    const total = Number(totalStr);

    const publicId = req.body.public_id;
    if (!publicId) {
      throw new ApiError(400, "public_id field is required");
    }
    if (!req.file) {
      throw new ApiError(400, "file field is required");
    }

    const { resourceType } = req.params;
    const isAsync = req.body.eager_async === "true" || req.body.eager_async === true;

    let entry = getFakeUpload(uploadId);
    if (!entry) {
      if (start !== 0) {
        throw new ApiError(400, "No upload in progress for this X-Unique-Upload-Id — the first chunk must start at 0");
      }
      beginFakeUpload(uploadId, { publicId, resourceType, isAsync, totalBytes: total });
      entry = getFakeUpload(uploadId);
    }

    receiveFakeChunk(uploadId, req.file.buffer.length);
    entry = getFakeUpload(uploadId);

    const isLastChunk = end + 1 >= total;
    if (!isLastChunk) {
      return res.status(200).json(new ApiResponse(200, { done: false, receivedBytes: entry.receivedBytes, totalBytes: total }, "Chunk received"));
    }

    const asset = finalizeFakeAsset({ publicId, resourceType, bytes: total, isAsync });
    return res.status(200).json(
      new ApiResponse(
        200,
        {
          done: true,
          public_id: publicId,
          resource_type: resourceType,
          bytes: asset.bytes,
          secure_url: asset.url,
        },
        "Upload complete"
      )
    );
  })
);

export default { basePath: "/__e2e__/media", priority: 100, router };
