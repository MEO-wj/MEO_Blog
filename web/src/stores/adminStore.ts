import { create } from "zustand";
import { readCacheSync } from "../api/client";
import type { AdminProfile, Project, ProjectSummary } from "../api/types";
import type { SwitchHomeProject } from "../features/switch-ui/switchHomeData";

interface AdminStore {
  authenticated: boolean;
  profile: AdminProfile | null;
  projects: SwitchHomeProject[];
  rawProjects: Project[];
  setAuthenticated: (v: boolean) => void;
  setProfile: (p: AdminProfile | null) => void;
  setProjects: (p: Project[]) => void;
  setProjectSummaries: (p: ProjectSummary[]) => void;
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
    slug: p.slug,
    status: (p.status as "ready" | "soon" | "external") || "ready",
  };
}

export function mapProjectSummary(p: ProjectSummary): SwitchHomeProject {
  return {
    id: p.id,
    title: p.name,
    subtitle: p.category ?? "",
    category: p.category ?? "",
    coverLabel: p.name.charAt(0),
    icon: p.iconUrl ? "blog" : "empty",
    iconUrl: p.iconUrl || undefined,
    accentColor: p.accentColor || "#24c9f4",
    slug: p.slug,
    status: (p.status as "ready" | "soon" | "external") || "ready",
  };
}

// Initialize from localStorage cache to avoid empty flash on mount
const cachedSummaries = readCacheSync<ProjectSummary[]>("/projects?fields=summary", 5 * 60 * 1000);
const cachedProfile = readCacheSync<AdminProfile>("/profile", 10 * 60 * 1000);
const initialProjects = cachedSummaries ? cachedSummaries.map(mapProjectSummary) : [];

export const useAdminStore = create<AdminStore>((set) => ({
  authenticated: false,
  profile: cachedProfile,
  projects: initialProjects,
  rawProjects: [],
  setAuthenticated: (v) => set({ authenticated: v }),
  setProfile: (p) => set({ profile: p }),
  setProjects: (rawProjects) =>
    set({ rawProjects, projects: rawProjects.map(mapBackendProject) }),
  setProjectSummaries: (summaries) =>
    set({ projects: summaries.map(mapProjectSummary) }),
  logout: () =>
    set({ authenticated: false }),
}));
