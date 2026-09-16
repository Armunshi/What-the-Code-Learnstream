import { SignupForm } from '../features/auth';

// Thin wrapper kept at this path (docs/lanes/auth.json owns it, and
// Signup-students.jsx/Signup-Teacher.jsx already import it by this name) —
// the real two-step OTP-signup implementation lives in
// features/auth/SignupForm.jsx.
const Signup = ({ role, verb = 'amazing' }) => (
  <div className="p-4 rounded-lg border-2 border-gray-300 max-w-md mx-auto">
    <SignupForm role={role} verb={verb} />
  </div>
);

export default Signup;
