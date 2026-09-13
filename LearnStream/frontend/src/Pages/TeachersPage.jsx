  import React, { useContext, useEffect, useRef, useState } from "react";
  import { useParams, useNavigate } from 'react-router-dom';
  import axios from "../api/axios";
  import { Plus } from "lucide-react";
  import { Link } from "react-router-dom";
  import GeneralCourses from "../components/GeneralCourses";
  import CourseComp from "../components/CourseComp";
  import LearningGoals from "../components/udemycomponent";
import AuthContext from "../contexts/AuthProvider";

  const Teachers = () => {
    const { user_id } = useParams();
    const {auth,setAuth} = useContext(AuthContext);
    const errRef = useRef();
    const [errMsg, setErrMsg] = useState('');
    const [courses, setCourses] = useState([]);
    const [course_id, setCourse_id] = useState(''); // Single declaration for course_id
    const navigate = useNavigate();

    useEffect(() => {
      setErrMsg('');
    }, [user_id]);

    useEffect(() => {
      console.log('Current Auth',auth)
      const fetchCourses = async () => {
        try {
          const response = await axios.get(`courses/teacher/${auth?.user_id}`, {
            headers: { 'Content-Type': 'application/json' },
            withCredentials: true,
          });
          setCourses(response.data.data.Courses);
          console.log(response);
        } catch (err) {
          console.log(err);
          if (!err?.response) {
            setErrMsg('No Server Response');
          } else if (err.response?.status === 401) {
            setErrMsg('Unauthorized');
          } else {
            setErrMsg('Courses Retrieval Failed');
          }
          errRef.current.focus();
        }
      };
      fetchCourses();
    }, [auth?.accessToken]);

    const viewCourse = (course_id) => {
      navigate(`/teacher/${auth?.user_id}/${course_id}`);
    };

    return (
      <div>
        {/* Offers Section */}
        <div className="bg-gray-300 text-center text-xl font-semibold">
          <img src="../../public/assets/10ca89f6-811b-400e-983b-32c5cd76725a.jpg" alt="Offers" />
        </div>

        {/* Dashboard Header: identity + primary CTA, both above the fold */}
        <section className="border-b border-gray-200 bg-white px-6 py-6 md:px-10">
          <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Teacher Dashboard</p>
              <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
                Welcome, {auth?.name?.charAt(0).toUpperCase() + auth?.name?.slice(1)}
              </h1>
            </div>
            <Link to={`/teacher/${auth?.user_id}/makecourse`}>
              <button className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">
                <Plus size={18} /> Create Course
              </button>
            </Link>
          </div>
        </section>

        {/* My Courses Section */}
        <div className="mx-auto max-w-6xl p-6 md:p-10">
          <h3 className="mb-4 text-2xl font-semibold">My Courses</h3>
          {courses.length > 0 ? (
            <div className="flex flex-wrap gap-6">
              <CourseComp
                setCourse_id={setCourse_id}
                courses={courses}
                errMsg={errMsg}
                ButtonName={'Edit Course'}
                buttonHandler={viewCourse}
                errRef={errRef}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-gray-200 py-16 text-center">
              <p className="text-gray-500">You haven&apos;t created any courses yet.</p>
              <Link to={`/teacher/${auth?.user_id}/makecourse`}>
                <button className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                  <Plus size={16} /> Create your first course
                </button>
              </Link>
            </div>
          )}
        </div>

        {/* Cross-teacher discovery: demoted, secondary treatment so it never
            competes with the teacher's own course-management workflow above. */}
        <div className="border-t border-gray-100 bg-gray-50 px-6 py-8 md:px-10">
          <div className="mx-auto max-w-6xl">
            <h4 className="text-base font-semibold text-gray-600">What other instructors are teaching</h4>
            <p className="mb-4 text-sm text-gray-400">A quick look at the catalog for inspiration — not part of your course management.</p>
            <GeneralCourses
              ButtonName={`View Course`}
              buttonHandler={viewCourse}
              setCourse_id={setCourse_id}
              errMsg={errMsg}
              setErrMsg={setErrMsg}
              showCategoryBar={false}
              limit={3}
            />
            <Link to="/#courses" className="mt-2 inline-block text-sm font-medium text-blue-600 hover:text-blue-700">
              Browse the full catalog →
            </Link>
          </div>
        </div>

        <LearningGoals/>
      </div>
    );
  };

  export default Teachers;
