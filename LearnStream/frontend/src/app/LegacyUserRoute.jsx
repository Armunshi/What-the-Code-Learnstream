import { Navigate, useParams } from 'react-router-dom';

// Wraps an old :user_id-shaped route (teacher/:user_id, student/:user_id,
// etc.) so that once a route has a new equivalent (e.g. /course/:courseId,
// /account/*), redirecting old links there is a one-line change here rather
// than hunting down every <Link> to the old path.
//
// `to` is optional: given `(params) => newPath`, a truthy return value
// 301/redirects (React Router's `replace`) to that path. Until a lane
// supplies one for a given legacy route, this is a no-op passthrough —
// exactly today's behavior — so nothing changes for routes that don't have
// a new home yet.
export function LegacyUserRoute({ children, to }) {
  const params = useParams();

  if (typeof to === 'function') {
    const newPath = to(params);
    if (newPath) return <Navigate to={newPath} replace />;
  }

  return children;
}

export default LegacyUserRoute;
