import { useContext, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "../api/axios";
import AuthContext from "../contexts/AuthProvider";
import BackButton from "../components/BackButton";

const StudentProfile = () => {
  const { auth } = useContext(AuthContext);
  const [profile, setProfile] = useState(null);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [profileRes, coursesRes] = await Promise.all([
          axios.get("/user/student/me", {
            headers: { Authorization: `Bearer ${auth?.accessToken}` },
            withCredentials: true,
          }),
          axios.get(`/courses/student/${auth?.user_id}`, {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${auth?.accessToken}`,
            },
            withCredentials: true,
          }),
        ]);
        setProfile(profileRes.data.data);
        setCourses(coursesRes.data.data?.Courses || []);
      } catch (error) {
        console.error("Error loading student profile:", error);
      } finally {
        setLoading(false);
      }
    };

    if (auth?.accessToken) load();
  }, [auth?.accessToken, auth?.user_id]);

  if (loading) {
    return <div className="max-w-screen-xl mx-auto px-4 md:px-8 py-16">Loading…</div>;
  }

  return (
    <div className="max-w-screen-xl mx-auto px-4 md:px-8 py-16">
      <BackButton />
      <h1 className="text-3xl font-extrabold mb-8">My Profile</h1>

      <div className="rounded-lg border p-6 shadow-sm max-w-md mb-8">
        <p className="text-sm text-gray-500 uppercase font-semibold">Name</p>
        <p className="text-lg mb-4">{profile?.name}</p>
        <p className="text-sm text-gray-500 uppercase font-semibold">Email</p>
        <p className="text-lg mb-4">{profile?.email}</p>
        <p className="text-sm text-gray-500 uppercase font-semibold">Role</p>
        <p className="text-lg">Student</p>
      </div>

      <h2 className="text-xl font-bold mb-4">Enrolled Courses ({courses.length})</h2>
      {courses.length === 0 ? (
        <p className="text-gray-500">You haven&apos;t enrolled in any courses yet.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.map((course) => (
            <Link
              key={course._id}
              to={`/user/${course._id}`}
              className="rounded-lg border p-4 shadow-sm hover:shadow-md transition-shadow"
            >
              <p className="font-semibold">{course.title}</p>
              <p className="text-sm text-gray-500">{course.category}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default StudentProfile;
