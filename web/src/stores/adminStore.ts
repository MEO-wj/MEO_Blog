import { create } from "zustand";
import type { AdminProfile, Project } from "../api/types";
import type { SwitchHomeProject } from "../features/switch-ui/switchHomeData";

interface AdminStore {
  authenticated: boolean;
  profile: AdminProfile | null;
  projects: SwitchHomeProject[];
  rawProjects: Project[];
  setAuthenticated: (v: boolean) => void;
  setProfile: (p: AdminProfile | null) => void;
  setProjects: (p: Project[]) => void;
  logout: () => void;
}

export function mapBackendProject(p: Project): SwitchHomeProject {
  return {
    id: p.id,
    title: p.name,
    subtitle: p.description?.slice(0, 60) ?? "",
    category: p.category ?? "",
    coverLabel: p.name.charAt(0),
    icon: p.iconUrl ? "blog" : "empty",
    iconUrl: p.iconUrl || undefined,
    accentColor: p.accentColor || "#24c9f4",
    repoUrl: p.repoUrl || undefined,
    status: (p.status as "ready" | "soon" | "external") || "ready",
  };
}

export const useAdminStore = create<AdminStore>((set) => ({
  authenticated: false,
  profile: null,
  projects: [],
  rawProjects: [],
  setAuthenticated: (v) => set({ authenticated: v }),
  setProfile: (p) => set({ profile: p }),
  setProjects: (rawProjects) =>
    set({ rawProjects, projects: rawProjects.map(mapBackendProject) }),
  logout: () =>
    set({ authenticated: false, profile: null, projects: [], rawProjects: [] }),
}));
