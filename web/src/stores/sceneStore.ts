import { create } from "zustand";

interface SceneStore {
  totalModels: number;
  loadedModels: number;
  iconsReady: boolean;
  registerModel: () => void;
  modelLoaded: () => void;
  setIconsReady: () => void;
}

export const useSceneStore = create<SceneStore>((set) => ({
  totalModels: 0,
  loadedModels: 0,
  iconsReady: false,
  registerModel: () => set((s) => ({ totalModels: s.totalModels + 1 })),
  modelLoaded: () => set((s) => ({ loadedModels: s.loadedModels + 1 })),
  setIconsReady: () => set({ iconsReady: true }),
}));
