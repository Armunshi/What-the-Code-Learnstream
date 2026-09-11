import React from 'react'
import { Card } from "flowbite-react";
// import axios from '../api/axios';
import { Link,useNavigate } from 'react-router-dom';
const CourseComp = ({setCourse_id, courses=[],ButtonName,buttonHandler,errRef,errMsg}) => {
  
  const handleButtonClick=(e,courseId) => {
    e.preventDefault();
    setCourse_id(courseId)
    buttonHandler(courseId);
  }
  return (
    <>
      {/* Rendered outside the grid so it never occupies a grid cell — it used
          to sit as the grid's first child with two CSS classes ("errmsg" /
          "offscreen") that don't exist anywhere in the stylesheet, leaving an
          empty, unhidden <p> as the first cell and pushing every course card
          over by one slot. Kept always-mounted (not conditional) because
          StudentPage.jsx/TeachersPage.jsx call `errRef.current.focus()`
          unconditionally right after setting the error. */}
      <p
        ref={errRef}
        className={
          errMsg
            ? "mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            : "sr-only"
        }
        aria-live="assertive"
      >
        {errMsg}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {courses?.map((course) => (
        <Card
          className="w-full"
          key={course._id}
          imgSrc={course?.thumbnail}
        >
          <a href="#">
            <h5 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-white">
              {course?.title}
            </h5>
          </a>
          <p className="text-sm text-gray-600">Instructor: {course?.author?.name || "Unknown"}</p>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-2xl font-bold text-gray-900 dark:text-white">${course?.price}</span>
            <Link
              onClick={(e) => handleButtonClick(e, course?._id)}
              className="rounded-lg bg-brand-dark px-5 py-2.5 text-center text-sm font-medium text-white hover:bg-brand-dark/90 focus:outline-none focus:ring-4 focus:ring-brand/30"
            >
              {ButtonName}
            </Link>
          </div>
        </Card>
      ))}
      </div>
    </>
  )
}

export default CourseComp
