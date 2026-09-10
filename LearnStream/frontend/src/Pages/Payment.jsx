import { useContext, useState } from "react";
import AuthContext from "../contexts/AuthProvider";
import { displayRazorpay } from "./displayRazorpay";
import { useParams } from "react-router-dom";

function BuyCourseButton({ enrolled }) {
  const { auth } = useContext(AuthContext);
  const token = auth?.accessToken;
  const { course_id } = useParams();
  const course_ids = [course_id]; // 👈 Convert to array
  const [loading, setLoading] = useState(false);

  return (
    <button
      className="bg-green-600 text-white px-4 py-2 rounded disabled:opacity-60 disabled:cursor-not-allowed"
      onClick={() => {
        setLoading(true);
        displayRazorpay({
          course_ids,
          token,
          studentName: auth?.name,
          onSettled: () => setLoading(false),
        });
      }}
      disabled={enrolled || loading}
    >
      {enrolled ? "Already Enrolled" : loading ? "Processing…" : "Buy Now"}
    </button>
  );
}

export default BuyCourseButton;
