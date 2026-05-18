import { useState, useEffect } from "react";
import type { SceneLayout } from "./types";

export function useSceneLayout() {
  const [layout, setLayout] = useState<SceneLayout | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch("/Sence_layout.json", { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: SceneLayout) => {
        if (!cancelled) setLayout(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { layout, error };
}
