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

  const addAssignmentToModule = async (createdModuleId, assignments) => {
    for (const assignment of assignments) {
      if (!(assignment.file && assignment.title)) continue;
      patchItem(assignment.moduleId, 'assignments', assignment.id, { status: 'uploading', progress: 0, error: '' });
      try {
        const formdata = new FormData();
        formdata.append('title', assignment.title);
        formdata.append('assignmentFiles', assignment.file);
        formdata.append('deadline', JSON.stringify(assignment.deadline));

        await axios.post(
          `/courses/${course_id}/modules/${createdModuleId}/assignments`,
          formdata,
          {
            headers: { 'Content-Type': 'multipart/form-data' },
            onUploadProgress: (evt) => {
              const pct = evt.total ? Math.round((evt.loaded * 100) / evt.total) : 0;
              patchItem(assignment.moduleId, 'assignments', assignment.id, { progress: pct });
            },
          }
        );
        patchItem(assignment.moduleId, 'assignments', assignment.id, { status: 'done', progress: 100 });
      } catch (error) {
        console.error('Error adding assignment:', error);
        patchItem(assignment.moduleId, 'assignments', assignment.id, {
          status: 'error',
          error: error.response?.data?.message || 'Upload failed',
        });
        throw error;
      }
    }
  };

  const addLectureToModule = async (createdModuleId, lectures) => {
    for (const lecture of lectures) {
      if (!(lecture.file && lecture.title)) continue;
      patchItem(lecture.moduleId, 'lectures', lecture.id, { status: 'uploading', progress: 0, error: '' });
      try {
        const formData = new FormData();
        formData.append('title', lecture.title);
        formData.append('videourl', lecture.file);

        await axios.post(
          `/courses/${course_id}/modules/${createdModuleId}/lectures`,
          formData,
          {
            headers: { 'Content-Type': 'multipart/form-data' },
            onUploadProgress: (evt) => {
              const pct = evt.total ? Math.round((evt.loaded * 100) / evt.total) : 0;
              patchItem(lecture.moduleId, 'lectures', lecture.id, { progress: pct });
            },
          }
        );
        patchItem(lecture.moduleId, 'lectures', lecture.id, { status: 'done', progress: 100 });
      } catch (error) {
        console.error('Error adding lecture:', error);
        patchItem(lecture.moduleId, 'lectures', lecture.id, {
          status: 'error',
          error: error.response?.data?.message || 'Upload failed',
        });
        throw error;
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBannerError('');
    setBannerSuccess('');
    setSubmitting(true);

    try {
      for (const module of modules) {
        const response = await axios.post(
          `/courses/${course_id}/modules`,
          JSON.stringify({ title: module.name, description: module.description || '' }),
          { headers: { 'Content-Type': 'application/json' } }
        );
        const createdModuleId = response?.data?.data?._id;

        await addLectureToModule(
          createdModuleId,
          module.lectures.map((l) => ({ ...l, moduleId: module.id }))
        );
        await addAssignmentToModule(
          createdModuleId,
          module.assignments.map((a) => ({ ...a, moduleId: module.id }))
        );
      }

      setBannerSuccess('Modules submitted successfully!');
    } catch (error) {
      console.error('Error adding modules:', error);
      setBannerError(error.response?.data?.message || 'Something went wrong while submitting modules.');
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
