// src/utils/displayRazorpay.js
import axios from "../api/axios"; // Your Axios instance

async function loadScript(src) {
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}
export const displayRazorpay = async ({ course_ids, token, setCartItems, studentName, onSettled, onError }) => {
  const fail = (message) => {
    console.error(message);
    onError?.(message);
    onSettled?.();
  };

  const res = await loadScript("https://checkout.razorpay.com/v1/checkout.js");
  if (!res) {
    fail("Razorpay's checkout script failed to load. Check your internet connection and try again.");
    return;
  }

  const handlePaymentSuccess = async (response) => {
    try {
      // Verifying the payment also enrolls the student and clears the
      // purchased items from their cart server-side (Payment.controller.js
      // `verifyPayment`) — there is no separate enroll call to make here.
      const verifyRes = await axios.post(
        "/payment/verify",
        {
          razorpay_order_id: response.razorpay_order_id,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          withCredentials: true,
        }
      );

      if (verifyRes.data.success) {
        if (typeof setCartItems === "function") {
          setCartItems((prev) => prev.filter((item) => !course_ids.includes(item._id)));
        }
        onSettled?.();
      } else {
        fail("Payment verification failed. If you were charged, contact support.");
      }
    } catch (err) {
      fail(
        err.response?.data?.message ||
          "Payment verification failed. If you were charged, contact support."
      );
    }
  };

  let order;
  try {
    const { data } = await axios.post(
      "/payment/create-order",
      { course_ids },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        withCredentials: true,
      }
    );
    order = data.data;
  } catch (err) {
    fail(err.response?.data?.message || "Could not start checkout. Please try again.");
    return;
  }

  const options = {
    key: import.meta.env.VITE_RAZORPAY_KEY_ID || "rzp_test_yLlU5Vi0wMY8hC",
    amount: order.amount,
    currency: order.currency,
    name: "LearnStream",
    description: "Course Purchase",
    order_id: order.id,
    handler: (response) => {
      // Wrap to preserve the context
      handlePaymentSuccess(response);
    },
    prefill: studentName ? { name: studentName } : undefined,
    notes: {
      course_ids: course_ids.join(","),
    },
    theme: {
      color: "#3399cc",
    },
    modal: {
      // User closed the checkout popup without paying — release the button.
      ondismiss: () => onSettled?.(),
    },
  };

  try {
    const razorpay = new window.Razorpay(options);
    razorpay.open();
  } catch (err) {
    fail(err?.message || "Could not open the checkout window. Please try again.");
  }
};
