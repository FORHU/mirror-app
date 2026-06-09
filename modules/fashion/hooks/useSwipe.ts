import { useRef } from "react";

/**
 * Horizontal swipe/drag detection for paged carousels. Fires `onLeft` when the
 * pointer moves left past the threshold, `onRight` when it moves right. Works
 * for both touch and mouse. Returns handlers to spread onto the target element.
 */
export function useSwipe(onLeft: () => void, onRight: () => void) {
  const startX = useRef<number | null>(null);
  return {
    onTouchStart: (e: React.TouchEvent) => {
      startX.current = e.touches[0].clientX;
    },
    onTouchEnd: (e: React.TouchEvent) => {
      if (startX.current === null) return;
      const delta = e.changedTouches[0].clientX - startX.current;
      startX.current = null;
      if (delta < -40) onLeft();
      else if (delta > 40) onRight();
    },
    onMouseDown: (e: React.MouseEvent) => {
      startX.current = e.clientX;
    },
    onMouseUp: (e: React.MouseEvent) => {
      if (startX.current === null) return;
      const delta = e.clientX - startX.current;
      startX.current = null;
      if (delta < -40) onLeft();
      else if (delta > 40) onRight();
    },
    onMouseLeave: () => {
      startX.current = null;
    },
  };
}
