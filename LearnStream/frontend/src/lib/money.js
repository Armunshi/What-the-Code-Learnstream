// All prices cross the wire as integer paise (docs/contracts/api-conventions.md
// — never rupees, never a float). This is the shared home for that
// conversion in the new `lib/` tree; `src/utils/money.js` is the pre-existing
// legacy copy other lanes still import and is left alone here.

// 49900 -> 499
export const paiseToRupees = (paise) => (Number(paise) || 0) / 100;

// 499 -> 49900. Rounds because a decimal string like "19.99" produces
// 1998.9999999999998 when multiplied by 100 without it.
export const rupeesToPaise = (rupees) => Math.round(Number(rupees) * 100);

// 49900 -> "₹499", 49950 -> "₹499.50". `price === 0` is a free course and
// callers that need to say "Free" instead of "₹0" check for that themselves.
export const formatPaise = (paise) => {
  const rupees = paiseToRupees(paise);
  return `₹${Number.isInteger(rupees) ? rupees : rupees.toFixed(2)}`;
};

export default { paiseToRupees, rupeesToPaise, formatPaise };
