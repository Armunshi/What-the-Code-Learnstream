import axios from "../api/axios";
import React, { useState } from "react";
import { useParams } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";
import FileDropzone from "./FileDropzone";

function LectureAssignmentForm({ moduleId }) {
  const [lectures, setLectures] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const { course_id } = useParams();
  const [submitting, setSubmitting] = useState(false);
  const [bannerError, setBannerError] = useState("");
  const [bannerSuccess, setBannerSuccess] = useState("");

  const handleAddLecture = () => {
    setLectures((prev) => [
      ...prev,
      { id: prev.length ? Math.max(...prev.map((l) => l.id)) + 1 : 1, title: "", file: null, status: "idle", progress: 0, error: "" },
    ]);
  };

  const handleAddAssignment = () => {
    setAssignments((prev) => [
      ...prev,
      { id: prev.length ? Math.max(...prev.map((a) => a.id)) + 1 : 1, title: "", deadline: "", file: null, status: "idle", progress: 0, error: "" },
    ]);
  };

  const patchLecture = (id, patch) => {
    setLectures((prev) => prev.map((lecture) => (lecture.id === id ? { ...lecture, ...patch } : lecture)));
  };

  const patchAssignment = (id, patch) => {
    setAssignments((prev) => prev.map((assignment) => (assignment.id === id ? { ...assignment, ...patch } : assignment)));
  };

  const handleDeleteLecture = (id) => {
    setLectures((prev) => prev.filter((lecture) => lecture.id !== id));
  };

  const handleDeleteAssignment = (id) => {
    setAssignments((prev) => prev.filter((assignment) => assignment.id !== id));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBannerError("");
    setBannerSuccess("");

    if (!moduleId) {
      setBannerError("Module ID is missing!");
      return;
    }

    setSubmitting(true);
    try {
      for (const lecture of lectures) {
        patchLecture(lecture.id, { status: "uploading", progress: 0, error: "" });
        try {
          const formData = new FormData();
          formData.append("title", lecture.title);
          formData.append("videourl", lecture.file);

          await axios.post(
            `/courses/${course_id}/modules/${moduleId}/lectures`,
            formData,
            {
              headers: { "Content-Type": "multipart/form-data" },
              onUploadProgress: (evt) => {
                const pct = evt.total ? Math.round((evt.loaded * 100) / evt.total) : 0;
                patchLecture(lecture.id, { progress: pct });
              },
            }
          );
          patchLecture(lecture.id, { status: "done", progress: 100 });
        } catch (error) {
          patchLecture(lecture.id, { status: "error", error: error.response?.data?.message || "Upload failed" });
          throw error;
        }
      }

      for (const assignment of assignments) {
        patchAssignment(assignment.id, { status: "uploading", progress: 0, error: "" });
        try {
          const formData = new FormData();
          formData.append("title", assignment.title);
          formData.append("deadline", assignment.deadline);
          formData.append("assignmentFiles", assignment.file);

          await axios.post(
            `/courses/${course_id}/modules/${moduleId}/assignments`,
            formData,
            {
              headers: { "Content-Type": "multipart/form-data" },
              onUploadProgress: (evt) => {
                const pct = evt.total ? Math.round((evt.loaded * 100) / evt.total) : 0;
                patchAssignment(assignment.id, { progress: pct });
              },
            }
          );
          patchAssignment(assignment.id, { status: "done", progress: 100 });
        } catch (error) {
          patchAssignment(assignment.id, { status: "error", error: error.response?.data?.message || "Upload failed" });
          throw error;
        }
      }

      setBannerSuccess("Lectures and assignments submitted successfully!");
    } catch (error) {
      console.error("Error submitting lectures/assignments:", error);
      setBannerError(error.response?.data?.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      {bannerError && (
        <div className="mb-4 flex items-start justify-between gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <span>{bannerError}</span>
          <button onClick={() => setBannerError("")} className="font-bold leading-none" aria-label="Dismiss">✕</button>
        </div>
      )}
      {bannerSuccess && (
        <div className="mb-4 flex items-start justify-between gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          <span>{bannerSuccess}</span>
          <button onClick={() => setBannerSuccess("")} className="font-bold leading-none" aria-label="Dismiss">✕</button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-gray-600">Lectures</h4>
          {lectures.map((lecture) => (
            <div key={lecture.id} className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={lecture.title}
                  onChange={(e) => patchLecture(lecture.id, { title: e.target.value })}
                  placeholder="Lecture title"
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => handleDeleteLecture(lecture.id)}
                  className="shrink-0 rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                  aria-label="Delete lecture"
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <FileDropzone
                file={lecture.file}
                accept="video/*"
                hint="MP4, MOV, or WebM"
                status={lecture.status}
                progress={lecture.progress}
                errorMessage={lecture.error}
                onFileChange={(file) => patchLecture(lecture.id, { file })}
              />
            </div>
          ))}
          <button
            type="button"
            onClick={handleAddLecture}
            className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100"
          >
            <Plus size={15} /> Add Lecture
          </button>
        </div>

        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-gray-600">Assignments</h4>
          {assignments.map((assignment) => (
            <div key={assignment.id} className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  type="text"
                  value={assignment.title}
                  onChange={(e) => patchAssignment(assignment.id, { title: e.target.value })}
                  placeholder="Assignment title"
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="date"
                  value={assignment.deadline}
                  onChange={(e) => patchAssignment(assignment.id, { deadline: e.target.value })}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => handleDeleteAssignment(assignment.id)}
                  className="shrink-0 self-start rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 sm:self-center"
                  aria-label="Delete assignment"
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <FileDropzone
                file={assignment.file}
                accept=".pdf"
                hint="PDF up to 10MB"
                status={assignment.status}
                progress={assignment.progress}
                errorMessage={assignment.error}
                onFileChange={(file) => patchAssignment(assignment.id, { file })}
              />
            </div>
          ))}
          <button
            type="button"
            onClick={handleAddAssignment}
            className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100"
          >
            <Plus size={15} /> Add Assignment
          </button>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submitting || (lectures.length === 0 && assignments.length === 0)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Submitting…" : "Submit"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default LectureAssignmentForm;
