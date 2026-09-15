// Normalizes every backend error shape (docs/contracts/api-conventions.md)
// into one predictable object, so components never branch on axios/fetch
// error internals — they just read `message` and, when present, `errors`.
//
// Shapes handled:
//   { message, errors: [{ field, code }] }         validation errors
//   { code: 'VERSION_CONFLICT', current }           optimistic-lock conflicts
//   { code: 'CURRICULUM_CONFLICT', current }        curriculum reorder conflict
//   { errors: [{ field: 'email', code: 'EMAIL_EXISTS' }] }  duplicate signup
//   { code: 'FREE_COURSE_ENROLL_DIRECTLY' }         commerce guard
//   402 with no body                                 PAYMENT_REQUIRED
export function normalizeApiError(error) {
  const status = error?.response?.status ?? null;
  const data = error?.response?.data ?? null;

  if (!error?.response) {
    // Network failure, timeout, or the request never left the browser (e.g.
    // aborted). There is no server payload to read a message from.
    return {
      message: 'Network error — please check your connection and try again.',
      errors: [],
      code: 'NETWORK_ERROR',
      status: null,
      current: null,
    };
  }

  if (status === 402) {
    return {
      message: data?.message || 'Payment required for this course.',
      errors: [],
      code: data?.code || 'PAYMENT_REQUIRED',
      status,
      current: null,
    };
  }

  return {
    message: data?.message || 'Something went wrong. Please try again.',
    errors: Array.isArray(data?.errors) ? data.errors : [],
    code: data?.code || null,
    status,
    current: data?.current ?? null,
  };
}

export default normalizeApiError;
