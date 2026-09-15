// Sanitized client error reporting (plan C-NFR-10). The whole point of this
// shape is what it leaves OUT: no raw stack trace, no exception message,
// nothing that could carry user input or internal file paths to wherever
// reports end up. It records *where* and *what kind* of failure happened,
// never the free-text detail of it.
//
// { courseId, sectionId, itemId, operation, timestamp, errorCode }
export function buildErrorReport({ courseId = null, sectionId = null, itemId = null, operation, errorCode }) {
  return {
    courseId,
    sectionId,
    itemId,
    operation,
    timestamp: new Date().toISOString(),
    errorCode: errorCode || 'UNKNOWN_ERROR',
  };
}

// Placeholder sink — Wave 0 only needs the sanitized shape to exist so
// later lanes can call it consistently. Wiring this to an actual endpoint
// is left to whichever lane needs real telemetry; for now it just logs.
export function reportError(report) {
  const safeReport = buildErrorReport(report);
  console.warn('[reportError]', safeReport);
  return safeReport;
}

export default reportError;
