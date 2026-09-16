// src/Pages/displayRazorpay.js
import { privateClient } from '@/lib/api/privateClient';
import { normalizeApiError } from '@/lib/api/errors';
import { cartKeys, meSummaryKeys } from '@/features/commerce/queryKeys';
import { toast } from 'sonner';

async function loadScript(src) {
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

// Drives one Razorpay checkout for `course_ids`. Callers: CartPage (the
// whole cart) and PurchaseCta's "Buy now" (a single course, skipping the
// cart entirely). `queryClient`/`navigate` are passed in rather than
// imported, since this is a plain function module, not a hook — the caller
// already has both from its own component.
export const displayRazorpay = async ({ course_ids, studentName, queryClient, navigate, onSettled, onError }) => {
  const fail = (message) => {
    console.error(message);
    onError?.(message);
    onSettled?.();
  };

  const razorpayKeyId = import.meta.env.VITE_RAZORPAY_KEY_ID;
  if (!razorpayKeyId) {
    fail('Payment is not configured correctly. Please contact support.');
    return;
  }

  const scriptLoaded = await loadScript('https://checkout.razorpay.com/v1/checkout.js');
  if (!scriptLoaded) {
    fail("Razorpay's checkout script failed to load. Check your internet connection and try again.");
    return;
  }

  // Success path (plan's W1-COM task list): invalidate meSummary/cart/
  // learning, toast, and navigate to the single course's player or to
  // My Learning for a multi-course checkout.
  const handlePaymentSuccess = async (response) => {
    try {
      await privateClient.post('/payment/verify', {
        razorpay_order_id: response.razorpay_order_id,
        razorpay_payment_id: response.razorpay_payment_id,
        razorpay_signature: response.razorpay_signature,
      });

      if (queryClient) {
        queryClient.invalidateQueries({ queryKey: meSummaryKeys.all });
        queryClient.invalidateQueries({ queryKey: cartKeys.all });
        queryClient.invalidateQueries({ queryKey: ['my-learning'] });
      }

      toast.success(course_ids.length === 1 ? "You're enrolled!" : 'Purchase complete — enjoy your courses!');
      navigate?.(course_ids.length === 1 ? `/learn/${course_ids[0]}` : '/my-learning');
      onSettled?.();
    } catch (err) {
      fail(normalizeApiError(err).message || 'Payment verification failed. If you were charged, contact support.');
    }
  };

  let order;
  try {
    const { data } = await privateClient.post('/payment/create-order', { course_ids });
    order = data.data;
  } catch (err) {
    fail(normalizeApiError(err).message || 'Could not start checkout. Please try again.');
    return;
  }

  const options = {
    key: razorpayKeyId,
    amount: order.amount,
    currency: order.currency,
    name: 'LearnStream',
    description: 'Course Purchase',
    order_id: order.id,
    handler: (response) => {
      handlePaymentSuccess(response);
    },
    prefill: studentName ? { name: studentName } : undefined,
    notes: {
      course_ids: course_ids.join(','),
    },
    theme: {
      color: '#3399cc',
    },
    modal: {
      // User closed the checkout popup without paying — release the button,
      // no toast (a deliberate dismissal isn't a failure).
      ondismiss: () => onSettled?.(),
    },
  };

  try {
    const razorpay = new window.Razorpay(options);
    // Razorpay's own recommended pattern: bind payment.failed explicitly
    // rather than relying on modal.ondismiss alone. A failed attempt shows
    // its own error inside the Razorpay modal, which the user then has to
    // close — ondismiss should cover that too, but the two events aren't
    // documented as mutually exclusive, and a stuck "Processing…" button
    // was reported in exactly this failed-then-closed sequence. Binding
    // both is defense-in-depth: onSettled is idempotent, so there's no
    // downside to both firing.
    razorpay.on('payment.failed', (response) => {
      console.error('Razorpay payment.failed', response?.error);
      fail(response?.error?.description || 'Payment failed. Please try again.');
    });
    razorpay.open();
  } catch (err) {
    fail(err?.message || 'Could not open the checkout window. Please try again.');
  }
};

export default displayRazorpay;
