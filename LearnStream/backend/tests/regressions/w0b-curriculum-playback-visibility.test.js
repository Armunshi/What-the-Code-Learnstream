import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { Sections } from "../../src/models/section.model.js";
import { VideoItem } from "../../src/models/curriculumItem.model.js";
import { createTeacher, createStudent, createCourse, enrollStudent, authHeader } from "../helpers.js";

const publish = async (course) => {
    course.status = "PUBLISHED";
    course.publishedAt = new Date();
    await course.save();
    return course;
};

// D1/D2/dto.md coverage for the new curriculum + playback endpoints
// (docs/contracts/dto.md "Curriculum tree" and "Playback"). This is the
// permanent version of the guest-curriculum-no-leak property a throwaway
// smoke test verified while wiring app.js — see also
// tests/regressions/1.1-course-modules-access.test.js, which covers the
// equivalent property for the LEGACY /courses/:course_id/modules endpoint;
// no prior test exercised these new endpoints, so nothing here replaces an
// existing one.
describe("W0-B — GET /courses/:courseId/curriculum", () => {
    it("200s a guest with no media/publicId anywhere in the response", async () => {
        const teacher = await createTeacher();
        const course = await publish(await createCourse(teacher));
        const section = await Sections.create({ course: course._id, title: "Section 1", order: 0 });
        await VideoItem.create({
            course: course._id,
            section: section._id,
            title: "Lecture 1",
            order: 0,
            isFreePreview: false,
            media: {
                provider: "cloudinary",
                publicId: "top-secret-public-id",
                mp4Url: "https://example.com/top-secret.mp4",
                status: "READY",
            },
        });

        const res = await request(app).get(`/courses/${course._id}/curriculum`);

        expect(res.status).toBe(200);
        const raw = JSON.stringify(res.body);
        expect(raw).not.toContain("top-secret-public-id");
        expect(raw).not.toContain("top-secret.mp4");
        expect(raw).not.toContain("publicId");
        const item = res.body.data.sections[0].items[0];
        expect(item.title).toBe("Lecture 1");
        expect(item.media).toBeUndefined();
    });

    it("includes media for the owner and for an enrolled student", async () => {
        const teacher = await createTeacher();
        const student = await createStudent();
        const course = await publish(await createCourse(teacher));
        await enrollStudent(student, course);
        const section = await Sections.create({ course: course._id, title: "Section 1", order: 0 });
        await VideoItem.create({
            course: course._id,
            section: section._id,
            title: "Lecture 1",
            order: 0,
            media: { provider: "cloudinary", mp4Url: "https://example.com/x.mp4", status: "READY" },
        });

        for (const viewer of [teacher, student]) {
            const res = await request(app)
                .get(`/courses/${course._id}/curriculum`)
                .set(authHeader(viewer));
            expect(res.status).toBe(200);
            expect(res.body.data.sections[0].items[0].media.mp4Url).toBe("https://example.com/x.mp4");
        }
    });

    it("hides a draft course from a guest but shows it to its owner (visibleCourseFilter, D2)", async () => {
        const teacher = await createTeacher();
        const course = await createCourse(teacher); // status defaults to DRAFT

        const guestRes = await request(app).get(`/courses/${course._id}/curriculum`);
        expect(guestRes.status).toBe(404);

        const ownerRes = await request(app)
            .get(`/courses/${course._id}/curriculum`)
            .set(authHeader(teacher));
        expect(ownerRes.status).toBe(200);
    });
});

describe("W0-B — GET /courses/:courseId/items/:itemId/playback", () => {
    it("403s a guest and a non-entitled student for a non-preview item", async () => {
        const teacher = await createTeacher();
        const outsider = await createStudent();
        const course = await publish(await createCourse(teacher));
        const section = await Sections.create({ course: course._id, title: "Section 1", order: 0 });
        const item = await VideoItem.create({
            course: course._id,
            section: section._id,
            title: "Lecture 1",
            order: 0,
            isFreePreview: false,
            media: { provider: "cloudinary", mp4Url: "https://example.com/x.mp4", status: "READY" },
        });

        const guestRes = await request(app).get(`/courses/${course._id}/items/${item._id}/playback`);
        expect(guestRes.status).toBe(403);

        const outsiderRes = await request(app)
            .get(`/courses/${course._id}/items/${item._id}/playback`)
            .set(authHeader(outsider));
        expect(outsiderRes.status).toBe(403);
    });

    it("200s a guest with playable URLs for a free-preview item in a PUBLISHED course", async () => {
        const teacher = await createTeacher();
        const course = await publish(await createCourse(teacher));
        const section = await Sections.create({ course: course._id, title: "Section 1", order: 0 });
        const item = await VideoItem.create({
            course: course._id,
            section: section._id,
            title: "Free Preview Lecture",
            order: 0,
            isFreePreview: true,
            media: { provider: "cloudinary", mp4Url: "https://example.com/preview.mp4", status: "READY" },
        });

        const res = await request(app).get(`/courses/${course._id}/items/${item._id}/playback`);
        expect(res.status).toBe(200);
        expect(res.body.data.mp4Url).toBe("https://example.com/preview.mp4");
    });

    it("403s a free-preview item in a DRAFT (not yet published) course for a guest", async () => {
        const teacher = await createTeacher();
        const course = await createCourse(teacher); // DRAFT
        const section = await Sections.create({ course: course._id, title: "Section 1", order: 0 });
        const item = await VideoItem.create({
            course: course._id,
            section: section._id,
            title: "Free Preview Lecture",
            order: 0,
            isFreePreview: true,
            media: { provider: "cloudinary", mp4Url: "https://example.com/preview.mp4", status: "READY" },
        });

        const res = await request(app).get(`/courses/${course._id}/items/${item._id}/playback`);
        expect(res.status).toBe(403);
    });

    it("200s the owner previewing their own entitled content regardless of preview flag", async () => {
        const teacher = await createTeacher();
        const course = await createCourse(teacher); // DRAFT
        const section = await Sections.create({ course: course._id, title: "Section 1", order: 0 });
        const item = await VideoItem.create({
            course: course._id,
            section: section._id,
            title: "Lecture 1",
            order: 0,
            isFreePreview: false,
            media: { provider: "cloudinary", mp4Url: "https://example.com/x.mp4", status: "READY" },
        });

        const res = await request(app)
            .get(`/courses/${course._id}/items/${item._id}/playback`)
            .set(authHeader(teacher));
        expect(res.status).toBe(200);
    });
});
