import { Router } from "express";
import crypto from "crypto";
import { z } from "zod";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { verifyAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { UPLOAD_KINDS, policyFor, CHUNK_SIZE_BYTES } from "../../config/uploadPolicy.js";
import { mediaProvider } from "../../services/media/index.js";
import { UploadSessions, UPLOAD_SESSION_STATUS } from "../../models/uploadSession.model.js";
import {
  resolveUploadTarget,
  applyUploadResult,
  applyUploadFailure,
  finalizeReadyByPublicId,
} from "../../services/media/uploadTargets.js";
import { env } from "../../config/env.js";
import { Courses } from "../../models/course.model.js";
import { CurriculumItems } from "../../models/curriculumItem.model.js";
import { RECONCILE_STUCK_AFTER_MS } from "../../config/uploadPolicy.js";
import { MEDIA_STATUS } from "../../models/schemas/media.schema.js";

// D4 (docs/contracts/domain-model.md): the direct-to-Cloudinary upload
// pipeline's teacher-facing endpoints. Mounted under /instructor (app.js's
// 1mb JSON parser applies), so no separate limit is set here.
//
// media-status lives here rather than at D4's literal
// "/instructor/courses/:courseId/media-status" path: this lane's manifest
// (docs/lanes/upl.json) owns exactly one routes/features file
// (uploads.routes.js), and the {basePath, priority, router} contract
// (loadFeatureRoutes.js) allows one basePath per file — a second file for a
// different basePath isn't something this lane can add without a manifest
// amendment. Since UPL owns both this endpoint and its only caller
// (features/uploads/useMediaStatus.js), keeping it under /instructor/uploads
// is a same-lane URL choice, not a cross-lane contract change; flagged in
// the final report as a deliberate deviation from the plan's literal path.
const router = Router();

const OBJECT_ID = z.string().regex(/^[0-9a-f]{24}$/i, "must be a valid id");

const signSchema = z.object({
  courseId: OBJECT_ID,
  target: z.object({
    kind: z.enum(UPLOAD_KINDS),
    itemId: OBJECT_ID.optional(),
    lang: z.string().min(1).max(20).optional(),
  }),
  file: z.object({
    name: z.string().min(1).max(255),
    size: z.number().int().positive(),
    mime: z.string().min(1),
  }),
});

router.post(
  "/sign",
  verifyAuth,
  validate(signSchema),
  asyncHandler(async (req, res) => {
    const { courseId, target, file } = req.body;
    const policy = policyFor(target.kind);

    const resolved = await resolveUploadTarget({ courseId, target, user: req.user });

    if (!policy.mimeTypes.includes(file.mime)) {
      throw new ApiError(400, `${file.mime} is not an allowed file type for ${target.kind}`, [
        { field: "file.mime", code: "UNSUPPORTED_MIME_TYPE" },
      ]);
    }
    if (file.size > policy.maxBytes) {
      throw new ApiError(400, `File is larger than the ${policy.maxBytes} byte limit for ${target.kind}`, [
        { field: "file.size", code: "FILE_TOO_LARGE" },
      ]);
    }

    const folder = `${env.media.uploadFolder}/${courseId}/${target.kind}`;
    const publicId = `${folder}/${crypto.randomUUID()}`;

    const session = await UploadSessions.create({
      course: resolved.course._id,
      user: req.user._id,
      target: { kind: target.kind, itemId: target.itemId, lang: target.lang },
      provider: mediaProvider.name,
      resourceType: policy.resourceType,
      publicId,
      file,
      status: UPLOAD_SESSION_STATUS.PENDING,
    });

    const signed = mediaProvider.sign({
      publicId,
      resourceType: policy.resourceType,
      folder,
      isAsync: policy.async,
    });

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          uploadId: session._id,
          uploadUrl: signed.uploadUrl,
          fields: signed.fields,
          chunkSizeBytes: CHUNK_SIZE_BYTES,
          provider: mediaProvider.name,
          resourceType: policy.resourceType,
          publicId,
        },
        "Upload signed"
      )
    );
  })
);

async function loadOwnedSession(req) {
  const session = await UploadSessions.findById(req.params.uploadId);
  if (!session) throw new ApiError(404, "Upload session not found");
  if (session.user.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "You are not authorized to act on this upload");
  }
  return session;
}

const completeSchema = z.object({
  publicId: z.string().min(1),
});

router.post(
  "/:uploadId/complete",
  verifyAuth,
  validate(completeSchema),
  asyncHandler(async (req, res) => {
    const session = await loadOwnedSession(req);

    if (req.body.publicId !== session.publicId) {
      throw new ApiError(400, "publicId does not match the id this upload was signed for", [
        { field: "publicId", code: "PUBLIC_ID_MISMATCH" },
      ]);
    }
    if (session.status !== UPLOAD_SESSION_STATUS.PENDING) {
      throw new ApiError(400, `This upload session already has status ${session.status}`);
    }

    const verified = await mediaProvider.verify({
      publicId: session.publicId,
      resourceType: session.resourceType,
    });
    if (!verified.found) {
      session.status = UPLOAD_SESSION_STATUS.FAILED;
      session.error = { code: "ASSET_NOT_FOUND", message: "The media provider has no asset at this publicId" };
      await session.save();
      throw new ApiError(422, "The media provider does not have this asset yet", [
        { field: "publicId", code: "ASSET_NOT_FOUND" },
      ]);
    }

    const resolved = await resolveUploadTarget({
      courseId: session.course.toString(),
      target: session.target,
      user: req.user,
    });

    const { status } = await applyUploadResult({
      ...resolved,
      target: session.target,
      session,
      verified,
    });

    session.status = UPLOAD_SESSION_STATUS.COMPLETE;
    await session.save();

    return res.status(200).json(new ApiResponse(200, { uploadId: session._id, status }, "Upload completed"));
  })
);

const failSchema = z.object({
  code: z.string().optional(),
  message: z.string().optional(),
});

router.post(
  "/:uploadId/fail",
  verifyAuth,
  validate(failSchema),
  asyncHandler(async (req, res) => {
    const session = await loadOwnedSession(req);

    session.status = UPLOAD_SESSION_STATUS.FAILED;
    session.error = { code: req.body.code ?? "UPLOAD_FAILED", message: req.body.message ?? "The upload failed" };
    await session.save();

    const resolved = await resolveUploadTarget({
      courseId: session.course.toString(),
      target: session.target,
      user: req.user,
    }).catch(() => null);

    if (resolved) {
      await applyUploadFailure({
        item: resolved.item,
        target: session.target,
        session,
        code: req.body.code,
        message: req.body.message,
      });
    }

    return res.status(200).json(new ApiResponse(200, { uploadId: session._id, status: session.status }, "Upload marked failed"));
  })
);

const statusQuerySchema = z.object({
  ids: z.string().min(1),
});

function parseStatusIds(raw) {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Reconciles a stuck-PROCESSING media subdocument by asking the provider
 * directly, instead of waiting on a webhook that may never arrive — D4 step
 * 4 / plan §9 risk 16's stated mitigation for localhost, where Cloudinary
 * has no route back to our webhook. Always reconciles for the fake provider
 * (no webhook infra exists there at all, so this poll is the only path to
 * READY); for the real provider it only calls the rate-limited Admin API
 * once a media item has sat in PROCESSING past RECONCILE_STUCK_AFTER_MS,
 * leaving the webhook as the normal, cheap path the rest of the time.
 */
function shouldReconcile(media) {
  if (mediaProvider.name === "fake") return true;
  const changedAt = media.statusChangedAt ? new Date(media.statusChangedAt).getTime() : 0;
  return Date.now() - changedAt > RECONCILE_STUCK_AFTER_MS;
}

async function reconcilePromoIfStuck(course) {
  const media = course.promoVideo;
  if (!media || media.status !== MEDIA_STATUS.PROCESSING || !media.publicId) return null;
  if (!shouldReconcile(media)) return null;

  const verified = await mediaProvider.verify({ publicId: media.publicId, resourceType: "video" });
  if (!verified.found || !verified.ready) return null;

  await finalizeReadyByPublicId(media.publicId, verified);
  const fresh = await Courses.findById(course._id);
  return fresh?.promoVideo ?? null;
}

async function reconcileItemIfStuck(item) {
  const media = item.media;
  if (!media || media.status !== MEDIA_STATUS.PROCESSING || !media.publicId) return null;
  if (!shouldReconcile(media)) return null;

  const verified = await mediaProvider.verify({ publicId: media.publicId, resourceType: "video" });
  if (!verified.found || !verified.ready) return null;

  await finalizeReadyByPublicId(media.publicId, verified);
  const fresh = await CurriculumItems.findById(item._id);
  return fresh?.media ?? null;
}

function formatStatusEntry(id, media) {
  if (!media || !media.status || media.status === MEDIA_STATUS.NONE) {
    return { id, status: MEDIA_STATUS.NONE };
  }
  return {
    id,
    status: media.status,
    mp4Url: media.mp4Url,
    hlsUrl: media.hlsUrl,
    posterUrl: media.posterUrl,
    error: media.error,
  };
}

async function resolveMediaStatusEntry({ id, course }) {
  if (id === "promo") {
    const reconciled = await reconcilePromoIfStuck(course);
    return formatStatusEntry("promo", reconciled ?? course.promoVideo);
  }

  if (!OBJECT_ID.safeParse(id).success) {
    return { id, status: "NOT_FOUND" };
  }

  const item = await CurriculumItems.findById(id);
  if (!item || item.course.toString() !== course._id.toString() || item.type !== "video") {
    return { id, status: "NOT_FOUND" };
  }

  const reconciled = await reconcileItemIfStuck(item);
  return formatStatusEntry(id, reconciled ?? item.media);
}

// See the module comment above for why this lives under /instructor/uploads
// instead of D4's literal /instructor/courses/:courseId/media-status path.
router.get(
  "/courses/:courseId/status",
  verifyAuth,
  asyncHandler(async (req, res) => {
    const { courseId } = req.params;
    if (!OBJECT_ID.safeParse(courseId).success) {
      throw new ApiError(400, "courseId must be a valid id");
    }
    const parsedQuery = statusQuerySchema.safeParse(req.query);
    if (!parsedQuery.success) {
      throw new ApiError(400, "The ids query parameter is required");
    }
    const ids = parseStatusIds(parsedQuery.data.ids);
    if (ids.length === 0) {
      throw new ApiError(400, "The ids query parameter must list at least one id");
    }

    const course = await Courses.findById(courseId);
    if (!course) throw new ApiError(404, "Course not found");
    if (!req.user || req.user.role !== "teacher" || course.author.toString() !== req.user._id.toString()) {
      throw new ApiError(403, "You are not authorized to view this course's media status");
    }

    const items = await Promise.all(ids.map((id) => resolveMediaStatusEntry({ id, course })));

    return res.status(200).json(new ApiResponse(200, { items }, "Media status"));
  })
);

export default { basePath: "/instructor/uploads", priority: 100, router };
