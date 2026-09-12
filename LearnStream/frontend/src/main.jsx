import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { Route, RouterProvider, createBrowserRouter, createRoutesFromElements } from 'react-router-dom';
import Layout from './Layout.jsx';
import { AuthProvider } from './contexts/AuthProvider.jsx';

import LoginS from './Pages/Login-students.jsx';
import LoginT from './Pages/Login-teacher.jsx';
import SignupS from './Pages/Signup-students.jsx';
import SignupT from './Pages/Signup-Teacher.jsx';
import Teachers from './Pages/TeachersPage.jsx';
import Student from './Pages/StudentPage.jsx';
import Home from './Pages/Home.jsx';
import MakeaCourse from './Pages/MakeaCourse.jsx';
// import ModuleForm from './Pages/Courseupdatation.jsx';
import ViewtheModules from './Pages/ViewtheModules.jsx';
import ViewStudentModules from './Pages/ViewStudentModule.jsx';
import LectureAssig from './Pages/LectureAssig.jsx';
import UploadedAssignment from './Pages/UploadedAssignment.jsx';
import LoginPage from './Pages/login.jsx';
import Cart from './Pages/Cart.jsx';
import About from './Pages/About.jsx';
import Services from './Pages/Services.jsx';
import Pricing from './Pages/Pricing.jsx';
import Contact from './Pages/Contact.jsx';
import StudentProfile from './Pages/StudentProfile.jsx';
import TeacherProfile from './Pages/TeacherProfile.jsx';

const router = createBrowserRouter(
  createRoutesFromElements(
    <Route path='/' element={<Layout />}>
      <Route path='/' element={<Home />} />
      <Route path='login' element={<LoginPage />} />
      <Route path='login/student' element={<LoginS />} />
      <Route path='login/teacher' element={<LoginT />} />
      <Route path='signup/student' element={<SignupS />} />
      <Route path='signup/teacher' element={<SignupT />} />
      <Route path='about' element={<About />} />
      <Route path='services' element={<Services />} />
      <Route path='pricing' element={<Pricing />} />
      <Route path='contact' element={<Contact />} />
      <Route path='teacher/:user_id/profile' element={<TeacherProfile />} />
      <Route path='teacher/:user_id' element={<Teachers />} />
      <Route path='teacher/:user_id/makecourse' element={<MakeaCourse />} />
      {/* <Route path='teacher/:user_id/:course_id' element={<ModuleForm />} /> */}
      <Route path='teacher/:user_id/:course_id' element={<ViewtheModules />} />
      <Route path='teacher/:user_id/:course_id/:assignmentId' element={<UploadedAssignment />} />
      <Route path='user/:course_id'  element={<ViewStudentModules/>} />
      <Route path='student/:user_id/Cart' element={<Cart/>}/>
      <Route path ='student/:user_id/:course_id/:module_id/view' element={<LectureAssig/>}/>
      <Route path='student/:user_id/profile' element={<StudentProfile />} />
      <Route path='student/:user_id' element={<Student />} />
      <Route path='cart/' element={<Cart/>} />

    </Route>
  )
);

// Vite content-hashes every chunk filename, so a deploy renames files like
// FilePlayer-<hash>.js. A tab left open across a deploy still holds the OLD
// index.html, which points at chunks the new deployment no longer serves —
// any dynamic import (react-player lazy-loads its player backends this way)
// then 404s with "Failed to fetch dynamically imported module" and the app
// crashes to React Router's raw error screen. This reproduced in production
// right after a real deploy.
//
// Vite dispatches `vite:preloadError` on window for exactly this failure.
// One silent reload picks up the current build and fixes it — the same
// class of fix as the auth cookie issue, but for static assets instead of
// cookies. Guarded with a sessionStorage flag so a genuinely broken deploy
// reloads once and then shows the real error, instead of loop-reloading.
window.addEventListener('vite:preloadError', () => {
  const key = 'reloaded-after-preload-error';
  if (sessionStorage.getItem(key)) return; // already tried once this session
  sessionStorage.setItem(key, '1');
  window.location.reload();
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </React.StrictMode>
);
