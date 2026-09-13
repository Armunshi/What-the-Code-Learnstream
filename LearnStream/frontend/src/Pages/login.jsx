import React, { useState, useContext, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import AuthContext from "../contexts/AuthProvider";
import axios from "../api/axios";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";

const LoginPage = () => {
  const navigate = useNavigate();
  const { auth, setAuth } = useContext(AuthContext);

  const [student, setStudent] = useState({ email: "", password: "", error: "", loading: false });
  const [teacher, setTeacher] = useState({ email: "", password: "", error: "", loading: false });

  // If already logged in via context (in-memory), redirect
  useEffect(() => {
    if (auth?.accessToken && auth?.user_id && auth?.role) {
      navigate(`/${auth.role}/${auth.user_id}`);
    }
  }, [auth, navigate]);

  const handleLogin = async (role, credentials, setCredentials) => {
    const { email, password } = credentials;

    try {
      setCredentials(prev => ({ ...prev, loading: true, error: "" }));

      const res = await axios.post(
        `/user/${role}/login`,
        JSON.stringify({ email, password }),
        {
          headers: { "Content-Type": "application/json" },
          withCredentials: true,
        }
      );

      const { accessToken, user, role: userRole } = res.data.data;
      const user_id = user._id;
      const name = user.name;

      // 🧠 Store token only in memory (auth context)
      setAuth({ user_id, name, role: userRole, accessToken });

      // 💾 Store non-sensitive info for persistence
      localStorage.setItem("userMeta", JSON.stringify({ user_id, name, role: userRole }));

      navigate(`/${userRole}/${user_id}`);
    } catch (err) {
      const msg = !err?.response
        ? "No Server Response"
        : err.response.status === 400
        ? "Missing Username or Password"
        : err.response.status === 401
        ? "Unauthorized"
        : "Login Failed";

      setCredentials(prev => ({ ...prev, error: msg }));
    } finally {
      setCredentials(prev => ({ ...prev, loading: false }));
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 font-sans">
      <div className="w-full max-w-6xl bg-white shadow-lg grid grid-cols-1 md:grid-cols-2 rounded-lg overflow-hidden">

        {/* Student Login */}
        <div className="p-10">
          <div className="flex flex-col items-center">
            <img src="/assets/student.jpeg" alt="Student" className="w-92" />
            <h2 className="text-2xl font-semibold text-gray-800 mb-2">Student Login</h2>
            <p className="text-sm text-gray-500">
              Not a member yet? <Link to="/signup/student" className="text-brand-dark hover:underline">Sign up!</Link>
            </p>
          </div>
          <form
            className="mt-6"
            onSubmit={(e) => {
              e.preventDefault();
              handleLogin("student", student, setStudent);
            }}
          >
            <Input
              type="email"
              placeholder="Email"
              value={student.email}
              onChange={(e) => setStudent({ ...student, email: e.target.value })}
              className="w-full mt-4"
              required
            />
            <Input
              type="password"
              placeholder="Password"
              value={student.password}
              onChange={(e) => setStudent({ ...student, password: e.target.value })}
              className="w-full mt-4"
              required
            />
            <div className="flex items-center justify-between mt-2 text-sm text-gray-500">
              <label className="flex items-center">
                <input type="checkbox" className="mr-1" /> Remember me
              </label>
              <a href="#" className="hover:underline">Forgot Password?</a>
            </div>
            <Button
              type="submit"
              className="w-full bg-brand-dark hover:bg-brand-dark/90 py-3 mt-4"
              disabled={student.loading}
            >
              {student.loading ? <Loader2 size={16} className="animate-spin" /> : "Login"}
            </Button>
            {student.error && <p className="text-red-500 text-center mt-2">{student.error}</p>}
          </form>
        </div>

        {/* Teacher Login */}
        <div className="bg-gray-50 p-10">
          <div className="flex flex-col items-center">
            <img src="/assets/teacher.jpeg" alt="Teacher" className="w-92" />
            <h2 className="text-2xl font-semibold text-gray-800 mb-2">Teacher Login</h2>
            <p className="text-sm text-gray-500">
              Not a member yet? <Link to="/signup/teacher" className="text-brand-dark hover:underline">Sign up!</Link>
            </p>
          </div>
          <form
            className="mt-6"
            onSubmit={(e) => {
              e.preventDefault();
              handleLogin("teacher", teacher, setTeacher);
            }}
          >
            <Input
              type="email"
              placeholder="Email"
              value={teacher.email}
              onChange={(e) => setTeacher({ ...teacher, email: e.target.value })}
              className="w-full mt-4"
              required
            />
            <Input
              type="password"
              placeholder="Password"
              value={teacher.password}
              onChange={(e) => setTeacher({ ...teacher, password: e.target.value })}
              className="w-full mt-4"
              required
            />
            <div className="flex items-center justify-between mt-2 text-sm text-gray-500">
              <label className="flex items-center">
                <input type="checkbox" className="mr-1" /> Remember me
              </label>
              <a href="#" className="hover:underline">Forgot Password?</a>
            </div>
            <Button
              type="submit"
              className="w-full bg-brand-dark hover:bg-brand-dark/90 py-3 mt-4"
              disabled={teacher.loading}
            >
              {teacher.loading ? <Loader2 size={16} className="animate-spin" /> : "Login"}
            </Button>
            {teacher.error && <p className="text-red-500 text-center mt-2">{teacher.error}</p>}
          </form>
        </div>

      </div>
    </div>
  );
};

export default LoginPage;
