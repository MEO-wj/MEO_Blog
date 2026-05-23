import { useEffect, useRef, useState } from "react";
import { useSceneStore } from "../stores/sceneStore";

export function LoadingOverlay() {
  const totalModels = useSceneStore((s) => s.totalModels);
  const loadedModels = useSceneStore((s) => s.loadedModels);
  const iconsReady = useSceneStore((s) => s.iconsReady);
  const [done, setDone] = useState(false);
  const minTimerDone = useRef(false);
  const readyRef = useRef(false);

  const allLoaded = totalModels > 0 && loadedModels >= totalModels;
  const ready = iconsReady || allLoaded;
  const progress = totalModels > 0 ? Math.min(100, Math.round((loadedModels / totalModels) * 100)) : 0;

  // Update ref in effect, not during render (React 18 concurrent mode safe)
  useEffect(() => {
    readyRef.current = ready;
  }, [ready]);

  // Min 1.5s display
  useEffect(() => {
    const t = setTimeout(() => {
      minTimerDone.current = true;
      if (readyRef.current) setDone(true);
    }, 1500);
    return () => clearTimeout(t);
  }, []);

  // Fade when icons ready or models done (after min timer)
  useEffect(() => {
    if (ready && minTimerDone.current) setDone(true);
  }, [ready]);

  const statusText = done
    ? "准备就绪"
    : totalModels === 0
      ? "正在连接..."
      : `正在加载模型 (${loadedModels}/${totalModels})`;

  // All styles inline to work before CSS loads
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
              background: "#63e6be",
              boxShadow: "0 0 12px rgba(99,230,190,0.9)",
            }}
          />
          <span
            style={{
              color: "#63e6be",
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
                background: "#63e6be",
                borderRadius: 9999,
                transition: "width 300ms ease-out",
                boxShadow: "0 0 20px rgba(99,230,190,0.4)",
              }}
            />
          </div>
        </div>
        <span style={{ color: "#8a9bbd", fontSize: 12 }}>{statusText}</span>
      </div>
    </div>
  );
}
