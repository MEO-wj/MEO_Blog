import type { APIResponse, AdminProfile, ProfileUpdate, Project, ProjectCreate, ProjectUpdate, GHUser, GHRepo, GHContributions, BlogCategory, BlogCategoryCreate, BlogPost, BlogPostCreate, BlogPostUpdate, BlogComment, BlogCommentCreate, GuestbookMessage, GuestbookMessageCreate, GuestbookReplyCreate, Favorite } from "./types";

const BASE_URL = import.meta.env.VITE_API_URL ?? "/api/v1";

async function request<T>(path: string, init?: RequestInit, retries = 2): Promise<T> {
  const isFormData = init?.body instanceof FormData;
  const headers: Record<string, string> = isFormData
    ? { ...init?.headers as Record<string, string> }
    : { "Content-Type": "application/json", ...init?.headers as Record<string, string> };

  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(`${BASE_URL}${path}`, {
        credentials: "include",
        ...init,
        headers,
      });
      const json: APIResponse<T> = await res.json();
      if (json.error) throw new Error(json.error.message);
      return json.data;
    } catch (err) {
      if (i === retries) throw err;
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw new Error("unreachable");
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
  logout: () => request<{ loggedOut: boolean }>("/admin/logout", { method: "POST" }),

  // Profile
  getPublicProfile: () => request<AdminProfile>("/profile"),
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

  // Resume
  getResume: () => request<{ url: string }>("/resume"),
  uploadResume: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<{ url: string }>("/admin/resume", {
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
  reorderProjects: (ids: string[]) =>
    request<void>("/admin/projects/reorder", {
      method: "PUT",
      body: JSON.stringify({ ids }),
    }),
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

  // Blog (public)
  getBlogCategories: () => request<BlogCategory[]>("/blog/categories"),
  getBlogPosts: (categorySlug?: string) =>
    request<BlogPost[]>(`/blog/posts${categorySlug ? `?category=${categorySlug}` : ""}`),
  getBlogPost: (id: string) => request<BlogPost>(`/blog/posts/${id}`),
  getBlogComments: (postId: string) => request<BlogComment[]>(`/blog/posts/${postId}/comments`),
  createBlogComment: (postId: string, data: BlogCommentCreate) =>
    request<BlogComment>(`/blog/posts/${postId}/comments`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Blog (admin)
  adminGetBlogPosts: (categorySlug?: string) =>
    request<BlogPost[]>(`/admin/blog/posts${categorySlug ? `?category=${categorySlug}` : ""}`),
  createBlogCategory: (data: BlogCategoryCreate) =>
    request<BlogCategory>("/admin/blog/categories", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateBlogCategory: (id: string, data: Partial<BlogCategoryCreate>) =>
    request<BlogCategory>(`/admin/blog/categories/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteBlogCategory: (id: string) =>
    request<void>(`/admin/blog/categories/${id}`, { method: "DELETE" }),
  createBlogPost: (data: BlogPostCreate) =>
    request<BlogPost>("/admin/blog/posts", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateBlogPost: (id: string, data: BlogPostUpdate) =>
    request<BlogPost>(`/admin/blog/posts/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteBlogPost: (id: string) =>
    request<void>(`/admin/blog/posts/${id}`, { method: "DELETE" }),
  deleteBlogComment: (id: string) =>
    request<void>(`/admin/blog/comments/${id}`, { method: "DELETE" }),

  // Guestbook (public)
  getGuestbookMessages: () => request<GuestbookMessage[]>("/guestbook/messages"),
  createGuestbookMessage: (data: GuestbookMessageCreate) =>
    request<GuestbookMessage>("/guestbook/messages", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  replyToGuestbookAsUser: (id: string, data: { nickname: string; content: string }) =>
    request<GuestbookMessage>(`/guestbook/messages/${id}/replies`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deleteOwnGuestbookMessage: (id: string) =>
    request<void>(`/guestbook/messages/${id}`, { method: "DELETE" }),

  // Guestbook (admin)
  replyToGuestbookMessage: (id: string, data: GuestbookReplyCreate) =>
    request<GuestbookMessage>(`/admin/guestbook/messages/${id}/replies`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deleteGuestbookMessage: (id: string) =>
    request<void>(`/admin/guestbook/messages/${id}`, { method: "DELETE" }),
  deleteGuestbookReply: (id: string) =>
    request<void>(`/admin/guestbook/replies/${id}`, { method: "DELETE" }),

  // Favorites (public)
  getFavorites: () => request<Favorite[]>("/favorites"),

  // Favorites (admin)
  createFavorite: (file: File, title?: string, description?: string) => {
    const form = new FormData();
    form.append("file", file);
    if (title) form.append("title", title);
    if (description) form.append("description", description);
    return request<Favorite>("/admin/favorites", {
      method: "POST",
      body: form,
      headers: {},
    });
  },
  deleteFavorite: (id: string) =>
    request<void>(`/admin/favorites/${id}`, { method: "DELETE" }),
  updateFavoritePosition: (id: string, posX: number | null, posY: number | null) =>
    request<void>(`/admin/favorites/${id}/position`, {
      method: "PATCH",
      body: JSON.stringify({ posX, posY }),
    }),
};
