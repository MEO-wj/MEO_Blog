import { create } from "zustand";

interface SceneStore {
  totalModels: number;
  loadedModels: number;
  registerModel: () => void;
  modelLoaded: () => void;
}

export const useSceneStore = create<SceneStore>((set) => ({
  totalModels: 0,
  loadedModels: 0,
  registerModel: () => set((s) => ({ totalModels: s.totalModels + 1 })),
  modelLoaded: () => set((s) => ({ loadedModels: s.loadedModels + 1 })),
}));
