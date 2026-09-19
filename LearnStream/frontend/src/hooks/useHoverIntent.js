import { useCallback, useMemo, useRef, useState } from 'react';

// Backs CoursePopover's open behavior (docs/contracts/stubs.md): opens after
// ~150ms of continuous pointer presence, closes ~150ms after the pointer
// leaves. Mouse only — touch devices never get a hover-triggered popover,
// they just navigate on tap (H-FR-2.1). Built now, ahead of CoursePopover
// itself, so CAT can wire it in Wave 1 without also inventing this timing
// primitive.
//
// Usage: const { isOpen, open, close, pointerHandlers } = useHoverIntent();
// spread `pointerHandlers` onto the hoverable element; call `open`/`close`
// directly for keyboard-triggered (focus-visible "Quick view" button) opens.
export function useHoverIntent({ openDelay = 150, closeDelay = 150 } = {}) {
  const [isOpen, setIsOpen] = useState(false);
  const openTimer = useRef(null);
  const closeTimer = useRef(null);

  const clearTimers = () => {
    if (openTimer.current) clearTimeout(openTimer.current);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    openTimer.current = null;
    closeTimer.current = null;
  };

  const open = useCallback(() => {
    clearTimers();
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    clearTimers();
    setIsOpen(false);
  }, []);

  const handlePointerEnter = useCallback(
    (event) => {
      if (event?.pointerType && event.pointerType !== 'mouse') return;
      if (closeTimer.current) {
        clearTimeout(closeTimer.current);
        closeTimer.current = null;
      }
      if (openTimer.current || isOpen) return;
      openTimer.current = setTimeout(() => {
        openTimer.current = null;
        setIsOpen(true);
      }, openDelay);
    },
    [isOpen, openDelay]
  );

  const handlePointerLeave = useCallback(
    (event) => {
      if (event?.pointerType && event.pointerType !== 'mouse') return;
      if (openTimer.current) {
        clearTimeout(openTimer.current);
        openTimer.current = null;
      }
      closeTimer.current = setTimeout(() => {
        closeTimer.current = null;
        setIsOpen(false);
      }, closeDelay);
    },
    [closeDelay]
  );

  const pointerHandlers = useMemo(
    () => ({ onPointerEnter: handlePointerEnter, onPointerLeave: handlePointerLeave }),
    [handlePointerEnter, handlePointerLeave]
  );

  return { isOpen, open, close, pointerHandlers };
}

export default useHoverIntent;
