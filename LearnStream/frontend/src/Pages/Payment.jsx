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
  const [error, setError] = useState(null);

  return (
    <div>
      {error && (
        <div className="flex items-start justify-between gap-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm p-3 mb-2">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="font-bold leading-none" aria-label="Dismiss">
            ✕
          </button>
        </div>
      )}
      <button
        className="bg-green-600 text-white px-4 py-2 rounded disabled:opacity-60 disabled:cursor-not-allowed"
        onClick={() => {
          setError(null);
          setLoading(true);
          displayRazorpay({
            course_ids,
            token,
            studentName: auth?.name,
            onSettled: () => setLoading(false),
            onError: setError,
          });
        }}
        disabled={enrolled || loading}
      >
        {enrolled ? "Already Enrolled" : loading ? "Processing…" : "Buy Now"}
      </button>
    </div>
  );
}

export default BuyCourseButton;
