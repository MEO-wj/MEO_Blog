import { useEffect, useRef } from "react";

/**
 * Manually handles wheel scrolling on a container element.
 * This bypasses any event system interference (e.g., R3F Canvas)
 * by directly setting scrollTop via JavaScript.
 */
interface WheelScrollOptions {
  wheelMultiplier?: number;
}

export function useWheelScroll<T extends HTMLElement>(options: WheelScrollOptions = {}) {
  const ref = useRef<T>(null);
  const wheelMultiplier = options.wheelMultiplier ?? 1;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    function onWheel(e: WheelEvent) {
      const container = ref.current;
      if (!container) return;

      // Let textarea and other scrollable inputs handle their own scrolling
      const target = e.target as HTMLElement;
      if (target && (target.tagName === "TEXTAREA" || target.tagName === "SELECT")) {
        return;
      }

      const { scrollHeight, clientHeight, scrollTop } = container;
      const maxScroll = scrollHeight - clientHeight;

      if (maxScroll <= 0) return;

      e.preventDefault();
      e.stopPropagation();

      const delta = e.deltaY * wheelMultiplier;
      container.scrollTop = Math.max(0, Math.min(maxScroll, scrollTop + delta));
    }

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [wheelMultiplier]);

  return ref;
}
