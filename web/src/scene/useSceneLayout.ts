import { useEffect, useState } from "react";
import type { SceneLayout } from "./types";

const LAYOUT_FETCH_TIMEOUT_MS = 15000;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchLayout(): Promise<SceneLayout> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), LAYOUT_FETCH_TIMEOUT_MS);

  try {
    const res = await fetch("/Sence_layout.json", {
      cache: "no-cache",
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json() as SceneLayout;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export function useSceneLayout() {
  const [layout, setLayout] = useState<SceneLayout | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadLayout() {
      let attempt = 0;

      while (!cancelled) {
        try {
          const data = await fetchLayout();

          if (!cancelled) {
            setLayout(data);
            setError(null);
          }
          return;
        } catch (err) {
          if (cancelled) return;
          setError(err instanceof Error ? err.message : "layout load failed");
          const wait = Math.min(1000 * 2 ** attempt, 15000);
          attempt++;
          await delay(wait);
        }
      }
    }

    loadLayout();

    return () => {
      cancelled = true;
    };
  }, []);

  return { layout, error };
}
