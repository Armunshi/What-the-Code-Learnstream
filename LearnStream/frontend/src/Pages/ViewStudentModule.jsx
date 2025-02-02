import React, { useState, useEffect, useCallback, useContext } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Progress } from "flowbite-react";
import axios from "../api/axios";
import { useNavigate, useParams } from "react-router-dom";
import AuthContext from "../contexts/AuthProvider"; 
import EnrollButton from "../components/EnrollButton";
// import Modal from "./Modal";
// import ModuleForm from "./Courseupdatation";
const ModuleDropdown = ({ module, viewResources}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border rounded-lg shadow-sm mb-4 bg-white">
      <button
        className="w-full flex justify-between items-center p-4 bg-gray-100 hover:bg-gray-200 rounded-t-lg"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="font-bold text-lg">{module.title}</span>
        {isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
      </button>
      {isOpen && (
        <div className="p-4">
          {module.lectures.length > 0 ? (
            module.lectures.map((lecture, index) => (
              <div
                key={index}
                className="py-2 border-b last:border-none hover:bg-gray-100"
              >
                <button
                  onClick={() => viewResources(module._id, module.lectures,module.assignments)}
                  className="font-medium w-full text-left"
                >
                  {lecture.title}
                </button>
                <span className="block text-gray-500 text-sm">
                  Duration: {lecture.duration.toFixed(2)} mins
                </span>
              </div>
            ))
          ) : (
            <p className="text-gray-500">No lectures available</p>
          )}
          <br/>
            {isOpen && (
        <div className="p-4">
          {module.assignments.length > 0 ? (
            module.assignments.map((assignment, index) => (
              <div
                key={index}
                className="py-2 border-b last:border-none hover:bg-gray-100"
              >
                <button
                  onClick={() => viewResources(module._id,module.lectures, module.assignments)}
                  className="font-medium w-full text-left"
                >
                  {assignment.title}
                </button>
              </div>
            ))
          ) : (
            <p className="text-gray-500">No lectures available</p>
          )}
        </div>
      )}
        </div>
      )}
    </div>
  );
};

const ViewStudentModules = () => {
  const { course_id } = useParams();
  console.log(course_id);
  const [enrolled,setEnroll] = useState(false)
  const user_id = localStorage.getItem('user_id')
  const [modules, setModules] = useState([]);
  const navigate = useNavigate();
  const viewResources = (module_id, lectures,assignments) => {
    console.log("Navigating with lectures:", lectures);
    if (enrolled){
      navigate(`/student/${user_id}/${course_id}/${module_id}/view`, { state: { course_id,lectures,assignments } });
    } // Debugging step
    else{
      alert(`please Enroll to view resources`)
    }
  };
  const loadModules = useCallback(async () => {
    console.log("Fetching modules for course ID:", course_id);
    if (!course_id || course_id === "modules") {
        console.error("Invalid course_id detected!");
        return;
    }
    try {
      const response = await axios.get(`/courses/${course_id}/modules`, {
        headers: { "Content-Type": "application/json" },
        withCredentials: true,
      });
      console.log("Modules fetched:", response.data);
      setModules(response.data.data);
    } catch (error) {
      console.error("Error fetching modules:", error);
    }
}, [course_id]);

  
// CourseDesc
const [course,setCourse] = useState({})
    const courseDetails = async ()=>{
      try {
        const response = await axios.get(`/courses/${course_id}/`,{
          headers: { "Content-Type": "application/json" },
          withCredentials: true,
        })
        setCourse(response.data.data);
        
      } catch (error) {
        console.log('error whilefetching course')
      }
    }
  const [CourseProgress, setCourseProgress] = useState({})
  const [completedLectures,setCompletedLectures] = useState(0)
  const [completedAssignments,setCompletedAssignments] = useState(0)
  const [totalLectures,settotalLectures] = useState(0)
  const [totalAssignments,settotalAssignments] = useState(0)
const courseProgressDetails = async ()=>{
  try {
    const response = await axios.get(`courses/${course_id}/progress`,{
      withCredentials:true,
    })
    if (response){
      setCourseProgress(response.data.data.progressPercentage);
      setCompletedLectures(response.data.data.completedLecturesCount)
      settotalLectures(response.data.data.totalLectures)
      setCompletedAssignments(response.data.data.completedAssignmentsCount)
      settotalAssignments(response.data.data.totalAssignments)
      console.log(response.data.data)
    }
  } catch (error) {
    console.error("Course Progress error",error);
  }
}
  useEffect(() => {
    loadModules();
    courseDetails();
    courseProgressDetails();
  }, [course_id]); // Fix infinite re-rendering
  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex-col items-center mb-4">

        <h1 className="text-3xl font-bold mb-4">{course.title}</h1>
        <h2 className="text-xl font-bold mb-2 font-league-200">Instructor : {course?.author?.name || 'someone'}</h2>
        <EnrollButton course_id={course_id} setEnroll={setEnroll}/>
        </div>
        <img src={course.thumbnail} alt="" srcset="" className="w-full "/>
      </div>

      <h2 className="text-xl font-bold mb-4">Course Description</h2>
      <p>{course.description}</p>
      <h2 className="text-xl font-bold mb-4">Course Progress</h2>
      <p>Lectures completed {completedLectures}/{totalLectures}</p>
      <p>Assignments completed {completedAssignments}/{totalAssignments}</p>
      <div >
        {CourseProgress}%
      <Progress progress={CourseProgress || 0} label={`${Math.round(CourseProgress || 0)}% Completed`} />
      </div>
    <div className="mb-4">
      <h2 className="text-2xl font-bold mb-2">Course Modules</h2>
      {modules.length > 0 ? (
        modules.map((module) => (
          <ModuleDropdown
            key={module._id}
            module={module}
            viewResources={viewResources}
          />
        ))
      ) : (
        <div>
          
          <p className="text-gray-500">No modules available</p>
        </div>
      )}
     </div>
    </div>
  );
};

export default ViewStudentModules;
