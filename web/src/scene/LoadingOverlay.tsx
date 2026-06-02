import { useEffect, useRef, useState } from "react";
import { useSceneStore } from "../stores/sceneStore";

interface LoadingOverlayProps {
  layoutReady: boolean;
  layoutError?: string | null;
}

export function LoadingOverlay({ layoutReady, layoutError }: LoadingOverlayProps) {
  const totalModels = useSceneStore((s) => s.totalModels);
  const loadedModels = useSceneStore((s) => s.loadedModels);
  const failedModels = useSceneStore((s) => s.failedModels);
  const skippedModels = useSceneStore((s) => s.skippedModels);
  const iconsReady = useSceneStore((s) => s.iconsReady);
  const contentReady = useSceneStore((s) => s.contentReady);
  const lastError = useSceneStore((s) => s.lastError);
  const [done, setDone] = useState(false);
  const minTimerDone = useRef(false);
  const readyRef = useRef(false);

  const settledModels = loadedModels + skippedModels + failedModels;
  const allModelsSettled = layoutReady && totalModels > 0 && settledModels >= totalModels;
  const ready = allModelsSettled && iconsReady && contentReady;

  // 3-stage progress: models (0-80%) → icons (80-90%) → content (90-100%)
  const modelProgress = totalModels > 0 ? settledModels / totalModels : 0;
  let progress: number;
  if (!allModelsSettled) {
    progress = Math.round(modelProgress * 80);
  } else if (!iconsReady) {
    progress = 80;
  } else if (!contentReady) {
    progress = 90;
  } else {
    progress = 100;
  }

  const activeError = layoutReady ? lastError : layoutError;
  const hasWarning = failedModels > 0 || skippedModels > 0 || Boolean(layoutError);

  useEffect(() => {
    readyRef.current = ready;
  }, [ready]);

  useEffect(() => {
    const t = setTimeout(() => {
      minTimerDone.current = true;
      if (readyRef.current) setDone(true);
    }, 1500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (ready && minTimerDone.current) setDone(true);
  }, [ready]);

  const statusText = done
    ? "Ready"
    : !layoutReady && layoutError
      ? "Network interrupted. Reconnecting layout..."
      : !layoutReady
        ? "Loading scene layout..."
        : failedModels > 0
          ? `Network interrupted. Retrying models (${loadedModels}/${totalModels})`
          : skippedModels > 0
            ? `Loaded with ${skippedModels} model fallback${skippedModels > 1 ? "s" : ""}`
            : !allModelsSettled
              ? `Loading models (${loadedModels}/${totalModels})`
              : !iconsReady
                ? "Loading interface assets..."
                : !contentReady
                  ? "Loading content..."
                  : "Ready";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#05070d",
        opacity: done ? 0 : 1,
        transition: "opacity 600ms ease-out",
        pointerEvents: done ? "none" : "all",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: hasWarning ? "#f4b740" : "#63e6be",
              boxShadow: hasWarning
                ? "0 0 12px rgba(244,183,64,0.85)"
                : "0 0 12px rgba(99,230,190,0.9)",
            }}
          />
          <span
            style={{
              color: hasWarning ? "#f4b740" : "#63e6be",
              fontFamily: "monospace",
              fontSize: 14,
              letterSpacing: 4,
              textTransform: "uppercase",
            }}
          >
            MEO_Blog
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <span style={{ color: "#d8e4ff", fontFamily: "monospace", fontSize: 32, fontVariantNumeric: "tabular-nums" }}>
            {progress}%
          </span>
          <div style={{ width: 256, height: 4, background: "#0e1424", borderRadius: 9999, overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                width: `${progress}%`,
                background: hasWarning ? "#f4b740" : "#63e6be",
                borderRadius: 9999,
                transition: "width 300ms ease-out",
                boxShadow: "0 0 20px rgba(99,230,190,0.4)",
              }}
            />
          </div>
        </div>
        <span style={{ color: "#8a9bbd", fontSize: 12 }}>{statusText}</span>
        {activeError && !done && (
          <span
            style={{
              maxWidth: 360,
              color: "#61708f",
              fontFamily: "monospace",
              fontSize: 11,
              lineHeight: 1.5,
              overflowWrap: "anywhere",
              textAlign: "center",
            }}
          >
            {activeError}
          </span>
        )}
      </div>
    </div>
  );
}
