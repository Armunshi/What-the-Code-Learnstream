import { Link } from "react-router-dom";

const About = () => {
  return (
    <div className="max-w-screen-xl mx-auto px-4 md:px-8 py-16">
      <h1 className="text-3xl sm:text-4xl font-extrabold mb-6">
        About <span className="text-[#7ED757]">Learn</span>Stream
      </h1>
      <p className="max-w-2xl text-lg text-gray-700 mb-4">
        LearnStream is an online learning platform connecting students with
        teachers through video lectures, assignments, and hands-on modules.
        Our goal is to make it easy for anyone to teach what they know and
        for anyone to learn what they need.
      </p>
      <p className="max-w-2xl text-lg text-gray-700 mb-8">
        Teachers can build structured courses out of modules, lectures, and
        assignments, and track how their students are progressing. Students
        can browse courses by category, enroll, and learn at their own pace
        with progress tracked automatically as they go.
      </p>
      <div className="flex gap-4">
        <Link
          to="/signup/student"
          className="rounded bg-[#588157] px-6 py-3 text-sm font-medium text-white shadow hover:bg-[#137dc7]"
        >
          Get Started as a Student
        </Link>
        <Link
          to="/signup/teacher"
          className="rounded border border-[#588157] px-6 py-3 text-sm font-medium text-[#588157] hover:bg-gray-50"
        >
          Become a Teacher
        </Link>
      </div>
    </div>
  );
};

export default About;
