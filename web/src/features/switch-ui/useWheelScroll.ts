import { useEffect, useRef } from "react";

/**
 * Manually handles wheel scrolling on a container element.
 * This bypasses any event system interference (e.g., R3F Canvas)
 * by directly setting scrollTop via JavaScript.
 */
export function useWheelScroll<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    function onWheel(e: WheelEvent) {
      const container = ref.current;
      if (!container) return;

      const { scrollHeight, clientHeight, scrollTop } = container;
      const maxScroll = scrollHeight - clientHeight;

      if (maxScroll <= 0) return;

      e.preventDefault();
      e.stopPropagation();

      const delta = e.deltaY;
      container.scrollTop = Math.max(0, Math.min(maxScroll, scrollTop + delta));
    }

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  return ref;
}
