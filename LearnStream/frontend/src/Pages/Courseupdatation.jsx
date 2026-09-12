import React, { useState, useEffect } from 'react';
import axios from '../api/axios';
import { useParams } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import FileDropzone from '../components/FileDropzone';

function ModuleForm() {
  const [modules, setModules] = useState([]);
  const { course_id } = useParams();
  const [ownerId, setOwnerId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [bannerError, setBannerError] = useState('');
  const [bannerSuccess, setBannerSuccess] = useState('');

  // handleSubmit below sends one module/lecture/assignment at a time, awaited
  // in sequence — a course with 2 modules and a few lectures/assignments each
  // is easily 6-10 separate requests behind one click of Submit, each
  // including a real Cloudinary upload. Closing the tab partway through
  // doesn't corrupt anything already sent (each request either finished
  // server-side or never started), but everything queued after that point
  // silently never gets created — no error, because the request was never
  // made. This reproduced for real: a "trees" module and both modules'
  // assignments were lost this way. The browser can't be stopped from
  // closing, but it can ask first while `submitting` is true.
  useEffect(() => {
    if (!submitting) return;
    const warnBeforeClose = (e) => {
      e.preventDefault();
      e.returnValue = ''; // required for the confirmation prompt in most browsers
    };
    window.addEventListener('beforeunload', warnBeforeClose);
    return () => window.removeEventListener('beforeunload', warnBeforeClose);
  }, [submitting]);

  const owner = async (course_id) => {
    try {
      const response = await axios.get(`/courses/${course_id}/getTeacher`);
      return response.data;
    } catch (error) {
      console.error("Error fetching teacher:", error);
      throw error;
    }
  };

  useEffect(() => {
    const getOwner = async () => {
      try {
        const data = await owner(course_id);
        setOwnerId(data?.author);
      } catch (error) {
        console.error("Failed to fetch course owner:", error);
      }
    };

    if (course_id) getOwner();
  }, [course_id]);

  const patchModule = (moduleId, patch) => {
    setModules((prev) =>
      prev.map((module) => (module.id === moduleId ? { ...module, ...patch } : module))
    );
  };

  const patchItem = (moduleId, type, itemId, patch) => {
    setModules((prev) =>
      prev.map((module) =>
        module.id === moduleId
          ? {
              ...module,
              [type]: module[type].map((item) =>
                item.id === itemId ? { ...item, ...patch } : item
              ),
            }
          : module
      )
    );
  };

  const handleAddModule = () => {
    setModules((prev) => [
      ...prev,
      { id: prev.length ? Math.max(...prev.map((m) => m.id)) + 1 : 1, name: '', lectures: [], assignments: [] },
    ]);
  };

  const handleDeleteModule = (id) => {
    setModules((prev) => prev.filter((module) => module.id !== id));
  };

  const handleAddLecture = (moduleId) => {
    setModules((prev) =>
      prev.map((module) =>
        module.id === moduleId
          ? {
              ...module,
              lectures: [
                ...module.lectures,
                { id: module.lectures.length ? Math.max(...module.lectures.map((l) => l.id)) + 1 : 1, title: '', file: null, status: 'idle', progress: 0, error: '' },
              ],
            }
          : module
      )
    );
  };

  const handleAddAssignment = (moduleId) => {
    setModules((prev) =>
      prev.map((module) =>
        module.id === moduleId
          ? {
              ...module,
              assignments: [
                ...module.assignments,
                { id: module.assignments.length ? Math.max(...module.assignments.map((a) => a.id)) + 1 : 1, title: '', file: null, deadline: '', status: 'idle', progress: 0, error: '' },
              ],
            }
          : module
      )
    );
  };

  const handleDeleteLecture = (moduleId, lectureId) => {
    setModules((prev) =>
      prev.map((module) =>
        module.id === moduleId
          ? { ...module, lectures: module.lectures.filter((l) => l.id !== lectureId) }
          : module
      )
    );
  };

  const handleDeleteAssignment = (moduleId, assignmentId) => {
    setModules((prev) =>
      prev.map((module) =>
        module.id === moduleId
          ? { ...module, assignments: module.assignments.filter((a) => a.id !== assignmentId) }
          : module
      )
    );
  };

  // Sends every module, lecture and assignment across the whole form as ONE
  // request, which the backend either fully creates or fully rolls back
  // (BACKEND_AUDIT.md §3.20) — not one request per module, then one per
  // lecture, then one per assignment, awaited in sequence, the way this used
  // to work. That older shape is what let closing the tab partway through
  // leave a course with its first module saved and everything queued after
  // it — a second module, both modules' assignments — never even sent, since
  // the browser's JavaScript simply stopped running before it reached those
  // later requests. One request removes the "partway through" entirely:
  // there is exactly one moment this can be interrupted at, which is before
  // it's sent at all — the beforeunload warning above covers that moment.
  const handleSubmit = async (e) => {
    e.preventDefault();
    setBannerError('');
    setBannerSuccess('');

    // A lecture/assignment row with no file or no title yet is a placeholder
    // the user hasn't finished, not something to submit — the old per-item
    // loops skipped these silently; do the same before building the request.
    const submittableModules = modules.map((module) => ({
      ...module,
      lectures: module.lectures.filter((lecture) => lecture.file && lecture.title),
      assignments: module.assignments.filter((assignment) => assignment.file && assignment.title),
    }));

    setSubmitting(true);

    const markAll = (patch) => {
      submittableModules.forEach((module) => {
        module.lectures.forEach((lecture) => patchItem(module.id, 'lectures', lecture.id, patch));
        module.assignments.forEach((assignment) => patchItem(module.id, 'assignments', assignment.id, patch));
      });
    };
    markAll({ status: 'uploading', progress: 0, error: '' });

    const formData = new FormData();
    formData.append(
      'structure',
      JSON.stringify(
        submittableModules.map((module) => ({
          title: module.name,
          description: module.description || '',
          lectures: module.lectures.map((lecture) => ({ title: lecture.title })),
          assignments: module.assignments.map((assignment) => ({
            title: assignment.title,
            deadline: assignment.deadline,
          })),
        }))
      )
    );
    // Field names the backend's bulk-module.service.js expects — the array
    // index here must match the index of the same item in `structure` above,
    // since that's how the two are correlated server-side.
    submittableModules.forEach((module, mi) => {
      module.lectures.forEach((lecture, li) => {
        formData.append(`module_${mi}_lecture_${li}`, lecture.file);
      });
      module.assignments.forEach((assignment, ai) => {
        // The backend accepts multiple files per assignment (_file_0, _file_1,
        // ...); this form only ever collects one.
        formData.append(`module_${mi}_assignment_${ai}_file_0`, assignment.file);
      });
    });

    try {
      await axios.post(`/courses/${course_id}/modules/bulk`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (evt) => {
          const pct = evt.total ? Math.round((evt.loaded * 100) / evt.total) : 0;
          markAll({ progress: pct });
        },
      });

      markAll({ status: 'done', progress: 100 });
      setBannerSuccess('Modules submitted successfully!');
    } catch (error) {
      console.error('Error adding modules:', error);
      const message = error.response?.data?.message || 'Something went wrong while submitting modules.';
      // All-or-nothing now: a failure here means the server rolled back
      // everything in this submission, not just the one item that happened
      // to be mid-upload when it failed.
      markAll({ status: 'error', error: message });
      setBannerError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      {bannerError && (
        <div className="mb-4 flex items-start justify-between gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <span>{bannerError}</span>
          <button onClick={() => setBannerError('')} className="font-bold leading-none" aria-label="Dismiss">✕</button>
        </div>
      )}
      {bannerSuccess && (
        <div className="mb-4 flex items-start justify-between gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          <span>{bannerSuccess}</span>
          <button onClick={() => setBannerSuccess('')} className="font-bold leading-none" aria-label="Dismiss">✕</button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {modules.map((module) => (
          <div key={module.id} className="relative rounded-lg border border-gray-200 bg-gray-50 p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-700">Module {module.id}</h3>
              <button
                type="button"
                onClick={() => handleDeleteModule(module.id)}
                className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                aria-label="Delete module"
              >
                <Trash2 size={16} />
              </button>
            </div>

            <div className="mb-5">
              <label className="mb-1 block text-sm font-medium text-gray-600">Module Name</label>
              <input
                type="text"
                value={module.name}
                onChange={(e) => patchModule(module.id, { name: e.target.value })}
                placeholder="e.g. Introduction to React Hooks"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="mb-5 space-y-3">
              <h4 className="text-sm font-semibold text-gray-600">Lectures</h4>
              {module.lectures.map((lecture) => (
                <div key={lecture.id} className="space-y-2 rounded-lg border border-gray-200 bg-white p-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={lecture.title}
                      onChange={(e) => patchItem(module.id, 'lectures', lecture.id, { title: e.target.value })}
                      placeholder="Lecture title"
                      className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => handleDeleteLecture(module.id, lecture.id)}
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
                    onFileChange={(file) => patchItem(module.id, 'lectures', lecture.id, { file })}
                  />
                </div>
              ))}
              <button
                type="button"
                onClick={() => handleAddLecture(module.id)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100"
              >
                <Plus size={15} /> Add Lecture
              </button>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-gray-600">Assignments</h4>
              {module.assignments.map((assignment) => (
                <div key={assignment.id} className="space-y-2 rounded-lg border border-gray-200 bg-white p-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <input
                      type="text"
                      value={assignment.title}
                      onChange={(e) => patchItem(module.id, 'assignments', assignment.id, { title: e.target.value })}
                      placeholder="Assignment title"
                      className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="date"
                      value={assignment.deadline}
                      onChange={(e) => patchItem(module.id, 'assignments', assignment.id, { deadline: e.target.value })}
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => handleDeleteAssignment(module.id, assignment.id)}
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
                    onFileChange={(file) => patchItem(module.id, 'assignments', assignment.id, { file })}
                  />
                </div>
              ))}
              <button
                type="button"
                onClick={() => handleAddAssignment(module.id)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100"
              >
                <Plus size={15} /> Add Assignment
              </button>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={handleAddModule}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-gray-300 py-2.5 text-sm font-medium text-gray-500 hover:border-blue-300 hover:text-blue-600"
        >
          <Plus size={16} /> Add Module
        </button>

        <button
          type="submit"
          disabled={submitting || modules.length === 0}
          className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? 'Submitting…' : 'Submit Modules'}
        </button>
      </form>
    </div>
  );
}

export default ModuleForm;
