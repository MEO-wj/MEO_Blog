import { create } from "zustand";

interface SceneStore {
  isLoading: boolean;
  layoutLoaded: boolean;
  setLayoutLoaded: (loaded: boolean) => void;
}

export const useSceneStore = create<SceneStore>((set) => ({
  isLoading: true,
  layoutLoaded: false,
  setLayoutLoaded: (loaded) => set({ layoutLoaded: loaded, isLoading: false }),
}));
