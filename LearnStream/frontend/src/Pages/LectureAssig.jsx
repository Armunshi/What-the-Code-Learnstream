import { useLocation } from "react-router-dom";
import ReactPlayer from "react-player";
import { Play } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { Card } from "flowbite-react";
import axios from "../api/axios.js";
import PDFPreviewModal from "../components/PDFPreviewModal.jsx";
import YourWork from "../components/YourWork.jsx";
import BackButton from "../components/BackButton.jsx";

const CLOUDINARY_CLOUD_NAME = "dc9lboron";

const LectureAssig = () => {
  const location = useLocation();
  const { course_id = "", lectures = [], assignments = [] } = location.state || {};
  const [lectureUrl, setLectureUrl] = useState("");
  const [currentLectureId, setCurrentLectureId] = useState(null);
  const [completedLectures, setCompletedLectures] = useState({});
  const [currentAssignmentId, setCurrentAssignmentId] = useState(null);
  const [assignmentUrls, setAssignmentUrls] = useState([]);
  const [selectedPdfUrl, setSelectedPdfUrl] = useState(null);
  const [selectedDiv, setSelectedDiv] = useState(null);
  const [assignmentDeadline, setAssignmentDeadline] = useState(null);

  // Read synchronously inside handleSelectLecture instead of the
  // `completedLectures` state closure, and set *before* the first `await`,
  // so two click events dispatched back-to-back (see below) both see the
  // guard update from whichever ran first, rather than both reading the
  // same stale "not completed yet" snapshot.
  const completedLecturesRef = useRef({});
  const pendingCompletionsRef = useRef(new Set());

  useEffect(() => {
    completedLecturesRef.current = completedLectures;
  }, [completedLectures]);

  useEffect(() => {
    const fetchCompletedLectures = async () => {
      try {
        const response = await axios.get(`/courses/${course_id}/completed`);
        const completedLectureIds = response.data.data.map(
          (lecture) => lecture.lectureId
        );
        const completedMap = completedLectureIds.reduce((acc, id) => {
          acc[id] = true;
          return acc;
        }, {});
        setCompletedLectures(completedMap);
        console.log("Completed lectures:", completedMap);
      } catch (error) {
        console.error("Error fetching completed lectures:", error);
      }
    };

    if (course_id) {
      fetchCompletedLectures();
    }
  }, [course_id]);

  const handleSelectLecture = async (lecture) => {
    setCurrentLectureId(lecture._id);
    setSelectedDiv("lecture");
    setLectureUrl(
      `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/video/upload/${lecture.public_id}.mp4`
    );

    // Guard against both the label/checkbox double-dispatch (fixed below,
    // at the input's own onClick) and a rapid double-click racing ahead of
    // the completed-state update: this check-and-mark-pending runs
    // synchronously, before the first `await`, so the second of two
    // back-to-back calls always sees the first one's pending flag.
    if (completedLecturesRef.current[lecture._id] || pendingCompletionsRef.current.has(lecture._id)) {
      return;
    }
    pendingCompletionsRef.current.add(lecture._id);
    try {
      await axios.post(`/courses/${course_id}/lectures/${lecture._id}/complete`, {
        lectureId: lecture._id,
      });

      setCompletedLectures((prev) => ({ ...prev, [lecture._id]: true }));
    } catch (error) {
      console.error("Error marking lecture as completed:", error);
    } finally {
      pendingCompletionsRef.current.delete(lecture._id);
    }
  };

  const handleSelectAssignment = (assignment) => {
    setSelectedDiv("assignment");
    setCurrentAssignmentId(assignment._id);
    setAssignmentDeadline(assignment.deadline);
    setAssignmentUrls(
      assignment.public_id.map(
        (url) => `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/${url}.pdf`
      )
    );
  };

    return (
      // BackButton used to be a direct child of the flex md:flex-row layout
      // below, which made it its own flex column squeezed to the left of the
      // content panels on desktop instead of sitting above them as a header —
      // it belongs outside the row, not inside it.
      <div>
        <div className="p-4 pb-0">
          <BackButton/>
        </div>
        <div className="flex flex-col md:flex-row">
        {/* Left Panel - Lecture & Assignment List */}
        <div className="bg-white border-t-2 md:border-t-0 md:border-r-2 border-black 
                w-full md:w-1/4 p-5 text-black overflow-y-auto order-last md:order-first">
          <h2 className="text-xl font-semibold mb-4">Lectures and Assignments</h2>

          {/* Lectures List */}
          <div className="flex-col relative">
            {lectures.length > 0 ? (
              lectures.map((lecture) => (
                <Card
                  key={lecture._id}
                  className={`mb-2 w-auto text-blue-500 gap-1 cursor-pointer ${
                    currentLectureId === lecture._id ? "bg-gray-200" : ""
                  }`}
                  onClick={() => handleSelectLecture(lecture)}
                >
                  <label className="flex items-center gap-2 cursor-pointer">
                    {/* A <label> wrapping a form control forwards a second,
                        synthetic click event to that control, which bubbles
                        up through the label to this Card's onClick just
                        like the original click did — so every physical
                        click on this row fired handleSelectLecture twice.
                        Stopping propagation here, at the forwarded click's
                        actual target, neutralizes only that synthetic
                        event; the original click on the label/span still
                        bubbles up normally and fires the handler once. */}
                    <input
                      type="checkbox"
                      checked={!!completedLectures[lecture._id]}
                      onClick={(e) => e.stopPropagation()}
                      readOnly
                    />
                    <span>{lecture.title} <Play /></span>
                  </label>
                </Card>
              ))
            ) : (
              <p className="text-gray-500">No lectures available</p>
            )}
          </div>

          {/* Assignments List */}
          <div className="flex-col relative">
            {assignments.length > 0 ? (
              assignments.map((assignment) => (
                <Card
                  key={assignment._id}
                  className={`mb-2 w-auto text-blue-500 gap-1 cursor-pointer ${
                    selectedDiv === "assignment" ? "bg-gray-200" : ""
                  }`}
                  onClick={() => handleSelectAssignment(assignment)}
                >
                  <span>{assignment.title} <Play /></span>
                </Card>
              ))
            ) : (
              <p className="text-gray-500">No Assignments available</p>
            )}
          </div>
        </div>

        {/* Right Panel - Video Player and Assignments */}
        <div className="flex-1 p-4">
          {/* Video Player */}
          {selectedDiv === "lecture" && lectureUrl ? (
            <ReactPlayer
              url={lectureUrl}
              playing={false}
              loop={false}
              controls={true}
              width="100%"
              height="500px"
            />
          ) : (
            <p className="text-center text-gray-500">
              Select a lecture to play or an assignment to view
            </p>
          )}

          {/* Assignment PDF List */}
          {selectedDiv === "assignment" && assignmentUrls.length > 0 ? (
            assignmentUrls.map((url, index) => (
              <Card
                key={index}
                onClick={() => setSelectedPdfUrl(url)}
                className="block w-full text-left py-2 px-4 bg-blue-500 text-white rounded-lg hover:bg-blue-700 mb-2"
              >
                Assignment {index + 1}
              </Card>
            ))
          ) : (
            <p className="text-gray-500">Please Select an Assignment</p>
          )}

          {/* PDF Preview Modal */}
          {selectedPdfUrl && (
            <PDFPreviewModal
              pdfUrl={selectedPdfUrl}
              onClose={() => setSelectedPdfUrl(null)}
            />
          )}
        </div>

        {selectedDiv === "assignment" && (
          <YourWork assignmentId={currentAssignmentId} courseId={course_id} deadline={assignmentDeadline} />
        )}
        </div>
      </div>
    );
  };

export default LectureAssig;
