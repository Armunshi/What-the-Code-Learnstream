
import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import axios from "../api/axios";

import CourseComp from "../components/CourseComp";
import GeneralCourses from "../components/GeneralCourses";
import { useContext } from "react";
import AuthContext from "../contexts/AuthProvider";

  const Student = () => {
    const { user_id } = useParams();
    const {auth } = useContext(AuthContext);
    const errRef = useRef();
    const [, setCourse_id] = useState('');
    const [errMsg, setErrMsg] = useState('');
    const [studentcourses,setStudentCourses] = useState([])

      useEffect(() => {
              setErrMsg('');
          }, [user_id])
        
    // const userAccessToken = localStorage.getItem('accessToken') 
    useEffect(()=>{ 
      console.log("Current Auth",auth);
      const fetchStudentCourses = async ()=>{
        try {
          const response =await axios.get(`courses/student/${user_id}`,{
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${auth?.accessToken}`,
            },
            withCredentials: true ,
        })
          setStudentCourses(response.data.data.Courses);
        
        } catch (err) {
          console.log(err)
              if (!err?.response) {
                  setErrMsg('No Server Response');
              }
              else if (err.response?.status === 401) {
                  setErrMsg('Unauthorized');
              } else {
                  setErrMsg('Courses Retrieval Failed');
              }
              errRef.current.focus();
        }
    }
    fetchStudentCourses();
  },[auth?.accessToken])
  const navigate  = useNavigate();
  const viewCourse = (course_id)=>{
    navigate(`/user/${course_id}`)
  }

    // This page's "My Learning" section is superseded by the new
    // /my-learning page (features/my-learning) — router.jsx wraps this
    // route in LegacyUserRoute without a `to` mapping (that file is frozen,
    // not owned by this lane), so the redirect is done here instead, inside
    // the one file this lane does own for this route. Placed after every
    // hook call above so it never changes the hooks called between renders.
    if (auth?.role === 'student') {
      return <Navigate to="/my-learning" replace />;
    }

    return (

      <div>
        
        <div className="bg-black text-center text-xl font-semibold relative w-full h-[500px]">
  <img 
    src="/assets/6caba229-b963-4af8-84b8-f71693be2507.jpg" 
    alt="Course Banner" 
    className="absolute inset-0 w-full h-full object-cover" 
  />
</div>


        <section className="m-5 text-3xl">
        <h1>Welcome <span className="font-league bold text-4xl">{auth?.name?.charAt(0).toUpperCase() + auth?.name?.slice(1)}</span></h1>
        </section>

        {/* My Learning Section */}
        <div className="p-6">
          <h3 className="text-2xl font-semibold mb-4">My Learning</h3>
          <CourseComp courses={studentcourses} setCourse_id={setCourse_id} ButtonName={`View Course`} buttonHandler={viewCourse} errRef={errRef} errMsg={errMsg}/>
        </div>
  
        {/* Top Courses Section */}
        <div className="p-6">
          <h3 className="text-2xl font-semibold mb-4">Top Courses</h3>
          <div className="flex gap-6">
          <GeneralCourses ButtonName={`View Course`} buttonHandler={viewCourse} setCourse_id = {setCourse_id}errMsg={errMsg} setErrMsg={setErrMsg}/>
          </div>
        </div>
        
      </div>
    );
  };
  
  export default Student;
