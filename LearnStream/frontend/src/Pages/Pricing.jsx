import { Link } from "react-router-dom";

const Pricing = () => {
  return (
    <div className="max-w-screen-xl mx-auto px-4 md:px-8 py-16">
      <h1 className="text-3xl sm:text-4xl font-extrabold mb-4">Pricing</h1>
      <p className="text-gray-600 mb-12 max-w-2xl">
        LearnStream doesn&apos;t charge a subscription. Signing up, browsing
        courses, and creating a teacher account are all free — you only pay
        for the individual courses you choose to enroll in.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-3xl">
        <div className="rounded-lg border p-6 shadow-sm">
          <h2 className="text-xl font-bold mb-2">Students</h2>
          <p className="text-3xl font-extrabold mb-4">Free to join</p>
          <ul className="text-gray-600 space-y-2 mb-6 list-disc list-inside">
            <li>Browse every course for free</li>
            <li>Pay only for courses you enroll in</li>
            <li>Keep access to courses you&apos;ve purchased</li>
          </ul>
          <Link
            to="/signup/student"
            className="block text-center rounded bg-[#588157] px-6 py-3 text-sm font-medium text-white shadow hover:bg-[#137dc7]"
          >
            Sign Up as a Student
          </Link>
        </div>

        <div className="rounded-lg border p-6 shadow-sm">
          <h2 className="text-xl font-bold mb-2">Teachers</h2>
          <p className="text-3xl font-extrabold mb-4">Free to publish</p>
          <ul className="text-gray-600 space-y-2 mb-6 list-disc list-inside">
            <li>Create and publish courses at no cost</li>
            <li>Set your own price for each course</li>
            <li>Reach students browsing by category</li>
          </ul>
          <Link
            to="/signup/teacher"
            className="block text-center rounded border border-[#588157] px-6 py-3 text-sm font-medium text-[#588157] hover:bg-gray-50"
          >
            Sign Up as a Teacher
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Pricing;
