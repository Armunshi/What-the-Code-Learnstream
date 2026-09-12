import React, { useCallback, useContext, useEffect, useState } from "react";
import { Button, Modal, FileInput } from "flowbite-react";
import axios from "../api/axios.js";
import AuthContext from "../contexts/AuthProvider";

const YourWork = ({ courseId, assignmentId, deadline }) => {
  const { auth } = useContext(AuthContext);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadedAssignmentUrls, setUploadedAssignmentUrls] = useState([]);
  // Replaces alert() for every outcome below — a native popup blocks the
  // whole page and needs a click to dismiss for something that isn't an
  // error needing acknowledgement. Auto-clears itself instead.
  const [status, setStatus] = useState(null); // { type: 'success' | 'error', text: string }

  useEffect(() => {
    if (!status) return;
    const timer = setTimeout(() => setStatus(null), 4000);
    return () => clearTimeout(timer);
  }, [status]);

  // Requires auth (requireEnrollment('assignment')). Sending the bearer
  // token explicitly, not relying on withCredentials alone — see
  // BACKEND_AUDIT.md §3.16: the cross-site auth cookie is fragile in
  // browsers that block third-party cookies, and this component never had
  // the header fallback ViewStudentModule.jsx's calls do.
  const authHeader = { Authorization: `Bearer ${auth?.accessToken}` };

  // Shared by the mount-time fetch and the post-upload refresh, so both read
  // the submission list the same way. This used to be two different, and
  // differently-broken, code paths (see below).
  const fetchUploadedAssignments = useCallback(async () => {
    try {
      const response = await axios.get(`/courses/${courseId}/assignments/${assignmentId}`, {
        headers: authHeader,
        withCredentials: true,
      });
      const uploaded = response.data.data.uploadedAssignments;
      setUploadedAssignmentUrls(uploaded.map((a) => a.submittedAssignmentUrls).flat());
    } catch (error) {
      console.error("Error fetching uploaded assignments:", error);
    }
  }, [courseId, assignmentId, auth?.accessToken]);

  useEffect(() => {
    fetchUploadedAssignments();
  }, [fetchUploadedAssignments]);

  const handleFileChange = (event) => {
    setSelectedFiles([...event.target.files]);
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      setStatus({ type: "error", text: "Please select at least one file to upload." });
      return;
    }

    const formData = new FormData();
    selectedFiles.forEach((file) => {
      formData.append("submissionFiles", file);
    });
    formData.append("deadline", deadline);

    try {
      await axios.post(`/courses/${courseId}/assignments/${assignmentId}/upload`, formData, {
        headers: authHeader,
        withCredentials: true,
      });
      setStatus({ type: "success", text: "Files uploaded successfully." });
      setSelectedFiles([]);
      setIsModalOpen(false);

      // Was GET .../submissions — no backend route defines that path (the
      // real one is singular, no suffix: BACKEND_AUDIT.md §3.14). That 404
      // was silently swallowed by the catch block below, after the success
      // message had already shown, so the list never actually refreshed
      // with the file that was just uploaded. Reusing the same fetch the
      // mount effect uses fixes both the route and the response shape
      // (this used to pass the raw axios response object straight into
      // state instead of response.data.data).
      await fetchUploadedAssignments();
    } catch (error) {
      console.error("Error uploading files:", error);
      setStatus({ type: "error", text: "Failed to upload files." });
    }
  };

  const markAsDone = async () => {
    try {
      const response = await axios.post(
        `/courses/${courseId}/assignments/${assignmentId}/complete`,
        {},
        { headers: authHeader, withCredentials: true }
      );

      if (response.data.data === true) {
        setStatus({ type: "success", text: "Marked as done!" });
      }
    } catch (error) {
      console.error("Error marking as done:", error);
      setStatus({ type: "error", text: "Failed to mark as done." });
    }
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow-md gap-4 text-center">
      <h3 className="text-lg font-semibold mb-4">Your Work</h3>

      {status && (
        <p
          className={`mb-3 text-sm rounded-md py-2 px-3 ${
            status.type === "success"
              ? "bg-green-50 text-green-700"
              : "bg-red-50 text-red-700"
          }`}
          role="status"
        >
          {status.text}
        </p>
      )}

      {/* Display uploaded assignments */}
      {uploadedAssignmentUrls?.length > 0 && (
        <div className="mb-4">
          <h4 className="font-semibold">Uploaded Assignments:</h4>
          <ul className="list-disc ml-6 gap-4">
            {uploadedAssignmentUrls.map((url, index) => (
              <li key={index} className="text-sm text-gray-600 flex justify-between gap-4 items-center">
                <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-500">
                  Assignment {index + 1}
                </a>

              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Add Files Button */}
      <Button onClick={() => setIsModalOpen(true)} color="blue" size="lg"
        className="mb-3">
        Add Files
      </Button>

      <Button color="green" size="lg" onClick={markAsDone}>
                  Mark as Done
      </Button>
      {/* Modal for File Upload */}
      <Modal show={isModalOpen} onClose={() => setIsModalOpen(false)} size="lg">
        <Modal.Header>Upload Assignments</Modal.Header>
        <Modal.Body>
          <FileInput onChange={handleFileChange} multiple />
          {selectedFiles.length > 0 && (
            <div className="mt-4">
              <p className="font-semibold">Selected Files:</p>
              <ul className="list-disc ml-6">
                {selectedFiles.map((file, index) => (
                  <li key={index} className="text-sm text-gray-600">
                    {file.name}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button onClick={handleUpload} color="blue">
            Upload
          </Button>
          <Button onClick={() => setIsModalOpen(false)} color="gray">
            Cancel
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default YourWork;
