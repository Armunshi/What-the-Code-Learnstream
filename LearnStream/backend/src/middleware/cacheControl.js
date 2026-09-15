// The only place routes set Cache-Control (docs/contracts/api-conventions.md
// "Caching") — a lane that needs a new cache policy calls this factory rather
// than setting the header itself, so every cacheable route in the codebase
// reads the same way.
//
// `cacheControl({ maxAge, staleWhileRevalidate })` — factory form, or the
// shorthand `cacheControl(maxAge, staleWhileRevalidate)` for the common
// `publicCache(60, 600)`-style call the contract doc shows.
export const cacheControl = (maxAgeOrOptions, staleWhileRevalidate) => {
  const { maxAge, staleWhileRevalidate: swr, private: isPrivate = false } =
    typeof maxAgeOrOptions === "object" && maxAgeOrOptions !== null
      ? maxAgeOrOptions
      : { maxAge: maxAgeOrOptions, staleWhileRevalidate };

  const visibility = isPrivate ? "private" : "public";
  const parts = [visibility, `max-age=${maxAge ?? 0}`];
  if (swr) parts.push(`stale-while-revalidate=${swr}`);

  return (req, res, next) => {
    res.set("Cache-Control", parts.join(", "));
    next();
  };
};

/** `cacheControl(60, 600)` — the short TTL used for public, cacheable GETs. */
export const publicCache = (maxAge, staleWhileRevalidate) =>
  cacheControl({ maxAge, staleWhileRevalidate, private: false });
