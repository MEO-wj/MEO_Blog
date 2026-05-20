import type { APIResponse, AdminProfile, ProfileUpdate, Project, ProjectCreate, ProjectUpdate, GHUser, GHRepo, GHContributions } from "./types";

const BASE_URL = import.meta.env.VITE_API_URL ?? "/api/v1";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const isFormData = init?.body instanceof FormData;
  const headers: Record<string, string> = isFormData
    ? { ...init?.headers as Record<string, string> }
    : { "Content-Type": "application/json", ...init?.headers as Record<string, string> };
  const res = await fetch(`${BASE_URL}${path}`, {
    credentials: "include",
    ...init,
    headers,
  });
  const json: APIResponse<T> = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.data;
}

export const api = {
  getHealth: () => request<{ status: string }>("/health"),

  // Auth
  login: (password: string, sequence: string) =>
    request<{ expiresAt: string }>("/admin/login", {
      method: "POST",
      body: JSON.stringify({ password, sequence }),
    }),
  checkSession: () => request<{ authenticated: boolean }>("/admin/session"),

  // Profile
  getProfile: () => request<AdminProfile>("/admin/profile"),
  updateProfile: (data: ProfileUpdate) =>
    request<AdminProfile>("/admin/profile", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  uploadAvatar: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<{ url: string }>("/admin/avatar", {
      method: "POST",
      body: form,
      headers: {},
    });
  },

  // Projects (public)
  getProjects: () => request<Project[]>("/projects"),

  // Projects (admin)
  createProject: (data: ProjectCreate) =>
    request<Project>("/admin/projects", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateProject: (id: string, data: ProjectUpdate) =>
    request<Project>(`/admin/projects/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteProject: (id: string) =>
    request<void>(`/admin/projects/${id}`, { method: "DELETE" }),
  uploadProjectIcon: (id: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<{ url: string }>(`/admin/projects/${id}/icon`, {
      method: "POST",
      body: form,
      headers: {},
    });
  },

  // GitHub (public, proxied through backend)
  getGithubUser: (username: string) =>
    request<{ user: GHUser; repos: GHRepo[] }>(`/github/${username}`),
  getGithubContributions: (username: string) =>
    request<GHContributions>(`/github/${username}/contributions`),
};
