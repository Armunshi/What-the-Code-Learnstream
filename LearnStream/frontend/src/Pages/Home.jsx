import { HomePage } from '@/features/catalog/pages/HomePage.jsx';

// app/router.jsx (frozen after Wave 0) still serves "/" through this legacy
// page rather than the features/catalog/routes.jsx registry entry — see that
// file's own comment for why. The real implementation lives in
// features/catalog/pages/HomePage.jsx; this is a thin pass-through so the
// legacy route renders it.
//
// This also closes the known bug this file used to have: Home.jsx rendered
// <GeneralCourses/> without passing it `setErrMsg`, so a failed category/
// course fetch there had nowhere to put its error message. HomePage doesn't
// use GeneralCourses at all (it fetches through TanStack Query and renders
// CategoryTabs/CourseGrid instead), so that call site — and the bug with it
// — no longer exists.
export function Home() {
  return <HomePage />;
}

export default Home;
