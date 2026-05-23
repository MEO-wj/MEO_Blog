import { create } from "zustand";

interface SceneStore {
  modelStates: Record<string, "pending" | "loaded" | "failed" | "skipped">;
  totalModels: number;
  loadedModels: number;
  failedModels: number;
  skippedModels: number;
  iconsReady: boolean;
  lastError: string | null;
  registerModel: (id: string) => void;
  modelLoaded: (id: string) => void;
  modelFailed: (id: string, message: string) => void;
  modelSkipped: (id: string, message: string) => void;
  clearModelFailure: (id: string) => void;
  setIconsReady: () => void;
}

function summarizeModelStates(modelStates: SceneStore["modelStates"]) {
  const states = Object.values(modelStates);
  return {
    totalModels: states.length,
    loadedModels: states.filter((state) => state === "loaded").length,
    failedModels: states.filter((state) => state === "failed").length,
    skippedModels: states.filter((state) => state === "skipped").length,
  };
}

export const useSceneStore = create<SceneStore>((set) => ({
  modelStates: {},
  totalModels: 0,
  loadedModels: 0,
  failedModels: 0,
  skippedModels: 0,
  iconsReady: false,
  lastError: null,
  registerModel: (id) => set((s) => {
    if (s.modelStates[id]) return s;
    const modelStates = { ...s.modelStates, [id]: "pending" as const };
    return { modelStates, ...summarizeModelStates(modelStates) };
  }),
  modelLoaded: (id) => set((s) => {
    if (s.modelStates[id] === "loaded") return s;
    const modelStates = { ...s.modelStates, [id]: "loaded" as const };
    const counts = summarizeModelStates(modelStates);
    return {
      modelStates,
      ...counts,
      lastError: counts.failedModels > 0 ? s.lastError : null,
    };
  }),
  modelFailed: (id, message) => set((s) => {
    const modelStates = { ...s.modelStates, [id]: "failed" as const };
    return {
      modelStates,
      ...summarizeModelStates(modelStates),
      lastError: message,
    };
  }),
  modelSkipped: (id, message) => set((s) => {
    const modelStates = { ...s.modelStates, [id]: "skipped" as const };
    return {
      modelStates,
      ...summarizeModelStates(modelStates),
      lastError: message,
    };
  }),
  clearModelFailure: (id) => set((s) => {
    if (s.modelStates[id] !== "failed") return s;
    const modelStates = { ...s.modelStates, [id]: "pending" as const };
    const counts = summarizeModelStates(modelStates);
    return {
      modelStates,
      ...counts,
      lastError: counts.failedModels > 0 ? s.lastError : null,
    };
  }),
  setIconsReady: () => set({ iconsReady: true }),
}));
