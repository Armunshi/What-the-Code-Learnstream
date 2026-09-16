// D6's swap point: "everything sits behind services/search/engine.js.
// engine.mongo.js is today's implementation; engine.atlas.js or a vector
// engine can swap in with the same response contract." Every caller in this
// feature imports from here, never from engine.mongo.js directly, so
// swapping the implementation later is a one-line change in this file.
export { findCandidates } from "./engine.mongo.js";
