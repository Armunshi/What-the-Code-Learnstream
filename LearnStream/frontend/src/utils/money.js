// Course prices are stored and transmitted as integer paise (BACKEND_AUDIT.md
// §2.7), so that no amount is ever a float and Razorpay always receives the
// integer it requires. Rupees exist only at the two edges of the UI: what a
// teacher types into the course form, and what a student reads on screen.
//
// These helpers are the only places that convert between the two. Anything
// else that multiplies or divides a price by 100 inline is a bug.

// 49900 → 499
export const paiseToRupees = (paise) => (Number(paise) || 0) / 100;

// 499 → 49900. Rounds because the teacher's input is a decimal string:
// "19.99" * 100 is 1998.9999999999998 without it.
export const rupeesToPaise = (rupees) => Math.round(Number(rupees) * 100);

// Renders paise as ₹-prefixed rupees, dropping decimals on whole amounts:
// 49900 → "₹499", 49950 → "₹499.50".
export const formatINR = (paise) => {
  const rupees = paiseToRupees(paise);
  return `₹${Number.isInteger(rupees) ? rupees : rupees.toFixed(2)}`;
};
