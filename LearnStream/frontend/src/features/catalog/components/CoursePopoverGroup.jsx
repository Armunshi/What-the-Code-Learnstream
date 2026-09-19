import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

// "CoursePopoverGroup keeps only one open at a time; re-hovering another
// card within 300ms skips the open delay" (docs/contracts/stubs.md). Wraps
// any grid of CourseCards (CourseGrid, and the search results grid that
// reuses CoursePopover unchanged per FR-SRC-2.3) so cards can coordinate
// without each one polling its siblings.
const CoursePopoverGroupContext = createContext(null);

const SKIP_DELAY_WINDOW_MS = 300;

export function CoursePopoverGroup({ children }) {
  const [openId, setOpenId] = useState(null);
  const lastCloseAtRef = useRef(0);

  const requestOpen = useCallback((id) => setOpenId(id), []);

  const requestClose = useCallback((id) => {
    setOpenId((current) => {
      if (current !== id) return current;
      lastCloseAtRef.current = Date.now();
      return null;
    });
  }, []);

  const recentlyClosed = useCallback(() => Date.now() - lastCloseAtRef.current < SKIP_DELAY_WINDOW_MS, []);

  const value = useMemo(() => ({ openId, requestOpen, requestClose, recentlyClosed }), [openId, requestOpen, requestClose, recentlyClosed]);

  return <CoursePopoverGroupContext.Provider value={value}>{children}</CoursePopoverGroupContext.Provider>;
}

// Safe to use standalone (a lone CourseCard rendered outside any
// CoursePopoverGroup, e.g. in a "you might like" rail with a single card) —
// falls back to per-card behavior with no group coordination.
export function useCoursePopoverGroup() {
  return useContext(CoursePopoverGroupContext);
}

export default CoursePopoverGroup;
