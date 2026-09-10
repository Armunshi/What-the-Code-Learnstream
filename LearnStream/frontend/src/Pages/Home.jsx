import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import GeneralCourses from "../components/GeneralCourses";
import LearningGoals from "../components/udemycomponent";
import Testimonials from "../components/testimonials";
import { useContext } from "react";
import AuthContext from "../contexts/AuthProvider";
import axios from "../api/axios";

const Home = () => {
  const courseDiv = useRef(null);
  const [course_id, setCourse_id] = useState("");
  const [courseCount, setCourseCount] = useState(null);
  const view = `View Course`;
  const navigate = useNavigate();
  const viewCourse = (course_id) => {
    navigate(`/user/${course_id}`);
  };
  const {auth,setAuth}  = useContext(AuthContext)
  const {user_id} = auth

  useEffect(() => {
    const fetchCourseCount = async () => {
      try {
        const response = await axios.get("/courses/getallCourses");
        setCourseCount(response.data?.data?.length ?? null);
      } catch {
        setCourseCount(null);
      }
    };
    fetchCourseCount();
  }, []);

  return (
    <>
      <section
        className="relative bg-[url('/assets/HeroImg.png')] bg-cover bg-center bg-no-repeat min-h-[500px] h-[90vh] w-full"
      >
        <div className=" absolute inset-0 bg-gradient-to-r from-black/75 to-transparent/0"></div>
        <div className="relative mx-auto max-w-screen-xl px-4 py-32 sm:px-6 lg:flex lg:h-screen lg:items-center lg:px-8">
          <div className="max-w-xl text-center ltr:sm:text-left">
            <h1 className="text-4xl font-extrabold sm:text-6xl">
              Transform Your Education Journey.
            </h1>
            <p className="mt-4 max-w-lg sm:text-xl/relaxed ">
              Take the first step toward mastering new skills and broadening
              your horizons.
            </p>
            {courseCount !== null && (
              <p className="mt-4 text-sm font-medium text-white/90">
                {courseCount}+ courses ready to explore
              </p>
            )}
            <div className="mt-8 flex flex-wrap gap-4 text-center justify-center">
              <Link
                to={user_id ? "#" : "/login"}
                className="block w-full rounded bg-[#588157] px-12 py-3 text-sm font-medium text-white shadow hover:bg-[#137dc7] focus:outline-none focus:ring sm:w-auto hover:text-black"
              >
                Get Started
              </Link>

              <a
                href="#courses"
                className="block w-full rounded bg-white px-12 py-3 text-sm font-medium text-black shadow hover:text-black focus:outline-none focus:ring sm:w-auto"
              >
                Learn More
              </a>
            </div>
          </div>
        </div>
      </section>

      <div id="courses" ref={courseDiv} className="font-sans font-bold ml-4 mt scroll-mt-20">
        Courses
        <div>
          <GeneralCourses
            setCourse_id={setCourse_id}
            ButtonName={view}
            buttonHandler={viewCourse}
          />{" "}
          {/* Fetches courses itself */}
        </div>
        <LearningGoals/>
          <br />
          <Testimonials/>
      </div>
    </>
  );
};

export default Home;
