import { Courses } from "../../models/course.model.js";
import { CurriculumItems, VideoItem, ResourceItem } from "../../models/curriculumItem.model.js";
import { Assignments } from "../../models/assignment.model.js";
import { ApiError } from "../../utils/ApiError.js";
import { MEDIA_STATUS } from "../../models/schemas/media.schema.js";
import { recomputeCurriculumStats } from "../stats/curriculumStats.js";
import { UploadSessions } from "../../models/uploadSession.model.js";
import { mediaProvider } from "./index.js";
import { policyFor } from "../../config/uploadPolicy.js";

/**
 * Resolves ownership upward from the upload target to the course (D4:
 * "Ownership is resolved upward from the target to the course"), the same
 * direction middleware/courseContext.js's resolvers use for the legacy
 * lecture/assignment routes — this module doesn't reuse that file because
 * its resolver table has no entry for CurriculumItems (a D1 model added
 * after courseContext.js was frozen in Wave 0), so re-deriving the same
 * upward-walk here for the new model is more honest than half-fitting a
 * resolver built for a different shape.
 *
 * Throws ApiError(403) for a non-owner, ApiError(404) for a missing/
 * mismatched course, item, or assignment — never silently narrows to "not
 * found" for an auth failure or vice versa, so callers get an accurate
 * status code straight from here.
 */
export async function resolveUploadTarget({ courseId, target, user }) {
  if (!user || user.role !== "teacher") {
    throw new ApiError(403, "This action requires the teacher role");
  }
  if (!courseId) throw new ApiError(400, "courseId is required");

  const course = await Courses.findById(courseId);
  if (!course) throw new ApiError(404, "Course not found");
  if (course.author.toString() !== user._id.toString()) {
    throw new ApiError(403, "You are not authorized to modify this course");
  }

  const { kind, itemId } = target;

  if (kind === "course-thumbnail" || kind === "course-promo") {
    return { course };
  }

  if (!itemId) {
    throw new ApiError(400, "target.itemId is required for this upload kind");
  }

  if (kind === "assignment-file") {
    const assignment = await Assignments.findById(itemId);
    if (!assignment) throw new ApiError(404, "Assignment not found");
    if (!assignment.course_id || assignment.course_id.toString() !== courseId) {
      throw new ApiError(404, "This assignment does not belong to the course named in the request");
    }
    return { course, assignment };
  }

  const item = await CurriculumItems.findById(itemId);
  if (!item) throw new ApiError(404, "Curriculum item not found");
  if (item.course.toString() !== courseId) {
    throw new ApiError(404, "This item does not belong to the course named in the request");
  }
  if (kind === "item-video" && item.type !== "video") {
    throw new ApiError(400, "item-video uploads only target a video curriculum item");
  }
  if (kind === "item-caption") {
    if (item.type !== "video") {
      throw new ApiError(400, "item-caption uploads only target a video curriculum item");
    }
    if (!target.lang) {
      throw new ApiError(400, "target.lang is required for a caption upload");
    }
  }

  return { course, item };
}

/**
 * Applies the verified upload result to its target document (D4 step 3:
 * "writes the target, and sets PROCESSING or READY"). Video kinds
 * (resourceType 'video', async per config/uploadPolicy.js) land in
 * PROCESSING here and are finished by finalizeReadyByPublicId below, once a
 * webhook or the reconcile poll confirms the eager transcode. Every other
 * kind is already fully verified off the Admin API response by the time
 * this runs, so it writes final fields immediately.
 *
 * Returns `{ status }` (the resulting media.status for video kinds, or
 * "READY" for every synchronous kind — even though most target shapes have
 * no persisted status field at all, e.g. ResourceSchema) so the /complete
 * handler's response can report something consistent regardless of kind.
 */
export async function applyUploadResult({ course, item, assignment, target, session, verified }) {
  const policy = policyFor(target.kind);
  const now = new Date();

  if (target.kind === "course-thumbnail") {
    const previousPublicId = course.thumbnailPublicId;
    await Courses.updateOne(
      { _id: course._id },
      { $set: { thumbnail: verified.url, thumbnailPublicId: session.publicId } }
    );
    await deleteIfReplaced(previousPublicId, session.publicId, policy.resourceType);
    return { status: "READY" };
  }

  if (target.kind === "course-promo") {
    const previousPublicId = course.promoVideo?.publicId;
    await Courses.updateOne(
      { _id: course._id },
      {
        $set: {
          "promoVideo.provider": session.provider,
          "promoVideo.publicId": session.publicId,
          "promoVideo.status": MEDIA_STATUS.PROCESSING,
          "promoVideo.statusChangedAt": now,
          "promoVideo.bytes": verified.bytes,
          "promoVideo.durationSec": verified.durationSec,
          "promoVideo.width": verified.width,
          "promoVideo.height": verified.height,
          "promoVideo.mp4Url": verified.url,
          "promoVideo.error": undefined,
        },
      }
    );
    await stagePendingDelete(session, previousPublicId, policy.resourceType);
    return { status: MEDIA_STATUS.PROCESSING };
  }

  if (target.kind === "assignment-file") {
    await Assignments.updateOne(
      { _id: assignment._id },
      {
        $push: {
          assignmentUrls: verified.url,
          public_id: session.publicId,
          resourceTypes: session.resourceType,
        },
      }
    );
    return { status: "READY" };
  }

  if (target.kind === "item-video") {
    const previousPublicId = item.media?.publicId;
    await VideoItem.updateOne(
      { _id: item._id },
      {
        $set: {
          "media.provider": session.provider,
          "media.publicId": session.publicId,
          "media.status": MEDIA_STATUS.PROCESSING,
          "media.statusChangedAt": now,
          "media.bytes": verified.bytes,
          "media.durationSec": verified.durationSec,
          "media.width": verified.width,
          "media.height": verified.height,
          "media.mp4Url": verified.url,
          "media.error": undefined,
        },
      }
    );
    await stagePendingDelete(session, previousPublicId, policy.resourceType);
    await recomputeCurriculumStats(course._id);
    return { status: MEDIA_STATUS.PROCESSING };
  }

  if (target.kind === "item-caption") {
    const captions = (item.media?.captions ?? []).filter((c) => c.lang !== target.lang);
    const previousCaption = (item.media?.captions ?? []).find((c) => c.lang === target.lang);
    captions.push({
      lang: target.lang,
      label: target.lang,
      url: verified.url,
      publicId: session.publicId,
      isDefault: (item.media?.captions ?? []).length === 0,
    });
    await VideoItem.updateOne({ _id: item._id }, { $set: { "media.captions": captions } });
    await deleteIfReplaced(previousCaption?.publicId, session.publicId, policy.resourceType);
    await recomputeCurriculumStats(course._id);
    return { status: "READY" };
  }

  if (target.kind === "item-resource") {
    if (item.type === "resource") {
      const previousPublicId = item.file?.publicId;
      await ResourceItem.updateOne(
        { _id: item._id },
        {
          $set: {
            file: {
              url: verified.url,
              publicId: session.publicId,
              filename: session.file.name,
              sizeBytes: verified.bytes ?? session.file.size,
              mimeType: session.file.mime,
            },
          },
        }
      );
      await deleteIfReplaced(previousPublicId, session.publicId, policy.resourceType);
    } else {
      await CurriculumItems.updateOne(
        { _id: item._id },
        {
          $push: {
            resources: {
              url: verified.url,
              publicId: session.publicId,
              filename: session.file.name,
              sizeBytes: verified.bytes ?? session.file.size,
              mimeType: session.file.mime,
            },
          },
        }
      );
    }
    await recomputeCurriculumStats(course._id);
    return { status: "READY" };
  }

  throw new ApiError(400, `Unknown upload target kind: ${target.kind}`);
}

/** Marks the failed session's target back to FAILED where a status field exists. */
export async function applyUploadFailure({ item, target, session, code, message }) {
  if (target.kind !== "item-video" && target.kind !== "course-promo") return;
  const error = { code: code ?? "UPLOAD_FAILED", message: message ?? "The upload failed" };

  if (target.kind === "course-promo") {
    await Courses.updateOne(
      { _id: session.course, "promoVideo.publicId": session.publicId },
      { $set: { "promoVideo.status": MEDIA_STATUS.FAILED, "promoVideo.statusChangedAt": new Date(), "promoVideo.error": error } }
    );
    return;
  }

  if (item) {
    await VideoItem.updateOne(
      { _id: item._id, "media.publicId": session.publicId },
      { $set: { "media.status": MEDIA_STATUS.FAILED, "media.statusChangedAt": new Date(), "media.error": error } }
    );
  }
}

/**
 * Stashes the old asset's id on the session instead of deleting it right
 * away — D4 step 5: "The old asset is deleted only after the new one is
 * READY." Video/promo kinds are PROCESSING at this point, so "ready" is
 * still in the future (a webhook or the reconcile poll calls
 * finalizeReadyByPublicId, which is what actually deletes it).
 */
async function stagePendingDelete(session, previousPublicId, resourceType) {
  if (!previousPublicId || previousPublicId === session.publicId) return;
  session.pendingDeletePublicId = previousPublicId;
  session.pendingDeleteResourceType = resourceType;
  await session.save();
}

/** Synchronous kinds have no PROCESSING gap — the new asset is already confirmed, so delete now. */
async function deleteIfReplaced(previousPublicId, newPublicId, resourceType) {
  if (!previousPublicId || previousPublicId === newPublicId) return;
  await mediaProvider.remove({ publicId: previousPublicId, resourceType });
}

/**
 * Finalizes a PROCESSING video/promo item to READY, given the provider's
 * confirmation of the finished (eager-transcoded) asset — called by both
 * the webhook handler and the media-status reconcile poll, so both paths
 * share one "what does READY actually mean" implementation.
 *
 * Idempotent by construction: if the item is already READY with this exact
 * publicId, both branches below are no-ops on write (same values) and the
 * pendingDelete fields are already cleared from the first call, so a
 * duplicate notification changes nothing (D4's duplicate-webhook test).
 */
export async function finalizeReadyByPublicId(publicId, result) {
  const session = await UploadSessions.findOne({ publicId });
  if (!session) return { applied: false, reason: "no matching upload session" };

  const now = new Date();
  const mediaUpdate = {
    status: MEDIA_STATUS.READY,
    statusChangedAt: now,
    bytes: result.bytes,
    durationSec: result.durationSec,
    width: result.width,
    height: result.height,
    mp4Url: result.url,
    hlsUrl: result.hlsUrl,
    posterUrl: result.posterUrl,
    error: undefined,
  };

  let applied = false;

  if (session.target.kind === "course-promo") {
    const course = await Courses.findOne({ _id: session.course, "promoVideo.publicId": publicId });
    if (course) {
      await Courses.updateOne(
        { _id: session.course },
        { $set: Object.fromEntries(Object.entries(mediaUpdate).map(([k, v]) => [`promoVideo.${k}`, v])) }
      );
      applied = true;
    }
  } else if (session.target.kind === "item-video" && session.target.itemId) {
    const item = await VideoItem.findOne({ _id: session.target.itemId, "media.publicId": publicId });
    if (item) {
      await VideoItem.updateOne(
        { _id: item._id },
        { $set: Object.fromEntries(Object.entries(mediaUpdate).map(([k, v]) => [`media.${k}`, v])) }
      );
      await recomputeCurriculumStats(session.course);
      applied = true;
    }
  }

  if (session.pendingDeletePublicId) {
    await mediaProvider.remove({
      publicId: session.pendingDeletePublicId,
      resourceType: session.pendingDeleteResourceType,
    });
    session.pendingDeletePublicId = undefined;
    session.pendingDeleteResourceType = undefined;
  }

  session.status = "COMPLETE";
  await session.save();

  return { applied, session };
}
