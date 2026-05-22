import type { APIResponse, AdminProfile, ProfileUpdate, Project, ProjectSummary, ProjectCreate, ProjectUpdate, GHUser, GHRepo, GHContributions, BlogCategory, BlogCategoryCreate, BlogPost, BlogPostCreate, BlogPostUpdate, BlogComment, BlogCommentCreate, GuestbookMessage, GuestbookMessageCreate, GuestbookReplyCreate, Favorite } from "./types";

const BASE_URL = import.meta.env.VITE_API_URL ?? "/api/v1";

// --- Request deduplication (GET only) ---
const inflight = new Map<string, Promise<unknown>>();

// --- localStorage cache ---
interface CacheEntry {
  data: unknown;
  timestamp: number;
  etag?: string; // HTTP ETag for conditional requests
}

function getCacheEntry(key: string): CacheEntry | null {
  try {
    const raw = localStorage.getItem(`cache:${key}`);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function getCache(key: string, ttlMs: number): { data: unknown; etag?: string } | null {
  const entry = getCacheEntry(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > ttlMs) {
    localStorage.removeItem(`cache:${key}`);
    return null;
  }
  return { data: entry.data, etag: entry.etag };
}

function setCache(key: string, data: unknown, etag?: string): void {
  try {
    const entry: CacheEntry = { data, timestamp: Date.now() };
    if (etag) entry.etag = etag;
    localStorage.setItem(`cache:${key}`, JSON.stringify(entry));
  } catch { /* quota exceeded, ignore */ }
}

function refreshCacheTimestamp(key: string): void {
  const entry = getCacheEntry(key);
  if (entry) {
    entry.timestamp = Date.now();
    try {
      localStorage.setItem(`cache:${key}`, JSON.stringify(entry));
    } catch { /* ignore */ }
  }
}

export function invalidateCache(path: string): void {
  localStorage.removeItem(`cache:${path}`);
}

/** Synchronous cache read for store initialization only (no background fetch).
 *  The component's useEffect will handle the async refresh via request(). */
export function readCacheSync<T>(path: string, cacheMs: number): T | null {
  const cacheKey = `GET:${path}`;
  const cached = getCache(cacheKey, cacheMs);
  return cached !== null ? (cached.data as T) : null;
}

async function request<T>(path: string, init?: RequestInit, retries = 2, cacheMs?: number): Promise<T> {
  const isFormData = init?.body instanceof FormData;
  const headers: Record<string, string> = isFormData
    ? { ...init?.headers as Record<string, string> }
    : { "Content-Type": "application/json", ...init?.headers as Record<string, string> };

  const method = (init?.method ?? "GET").toUpperCase();
  const cacheKey = `${method}:${path}`;

  // Return from cache immediately if valid (stale-while-revalidate)
  if (cacheMs && method === "GET") {
    const cached = getCache(cacheKey, cacheMs);
    if (cached !== null) {
      // Pass ETag for conditional request
      if (cached.etag) headers["If-None-Match"] = cached.etag;
      // Fire network request in background to refresh cache
      fetchAndCache<T>(cacheKey, path, init, headers, retries).catch(() => {});
      return cached.data as T;
    }
  }

  // Deduplicate in-flight GET requests
  if (method === "GET" && inflight.has(cacheKey)) {
    return inflight.get(cacheKey)! as Promise<T>;
  }

  // Pass ETag from cache for conditional request
  if (cacheMs && method === "GET") {
    const entry = getCacheEntry(cacheKey);
    if (entry?.etag) headers["If-None-Match"] = entry.etag;
  }

  const promise = fetchAndCache<T>(cacheKey, path, init, headers, retries, cacheMs);
  if (method === "GET") {
    inflight.set(cacheKey, promise);
    promise.finally(() => inflight.delete(cacheKey));
  }
  return promise;
}

async function fetchAndCache<T>(
  cacheKey: string,
  path: string,
  init: RequestInit | undefined,
  headers: Record<string, string>,
  retries: number,
  cacheMs?: number,
): Promise<T> {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(`${BASE_URL}${path}`, {
        credentials: "include",
        ...init,
        headers,
      });

      // Handle 304 Not Modified — data unchanged, refresh cache timestamp
      if (res.status === 304) {
        if (cacheMs) refreshCacheTimestamp(cacheKey);
        // Return cached data
        const entry = getCacheEntry(cacheKey);
        if (entry) return entry.data as T;
        // Fallback: if cache was somehow lost, re-request without ETag
        delete headers["If-None-Match"];
        continue;
      }

      const json: APIResponse<T> = await res.json();
      if (json.error) throw new Error(json.error.message);

      // Store data and ETag from response
      if (cacheMs) {
        const etag = res.headers.get("ETag") ?? undefined;
        setCache(cacheKey, json.data, etag);
      }
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
  checkSession: () => request<{ authenticated: boolean }>("/admin/session", undefined, 2, 2 * 60 * 1000),
  logout: () => {
    invalidateCache("GET:/admin/session");
    return request<{ loggedOut: boolean }>("/admin/logout", { method: "POST" });
  },

  // Profile
  getPublicProfile: () => request<AdminProfile>("/profile", undefined, 2, 10 * 60 * 1000),
  getProfile: () => request<AdminProfile>("/admin/profile", undefined, 2, 5 * 60 * 1000),
  updateProfile: (data: ProfileUpdate) => {
    invalidateCache("GET:/profile");
    invalidateCache("GET:/admin/profile");
    return request<AdminProfile>("/admin/profile", {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },
  uploadAvatar: (file: File) => {
    invalidateCache("GET:/profile");
    invalidateCache("GET:/admin/profile");
    const form = new FormData();
    form.append("file", file);
    return request<{ url: string }>("/admin/avatar", {
      method: "POST",
      body: form,
      headers: {},
    });
  },

  // Resume
  getResume: () => request<{ url: string }>("/resume", undefined, 2, 30 * 60 * 1000),
  uploadResume: (file: File) => {
    invalidateCache("GET:/resume");
    invalidateCache("GET:/profile");
    invalidateCache("GET:/admin/profile");
    const form = new FormData();
    form.append("file", file);
    return request<{ url: string }>("/admin/resume", {
      method: "POST",
      body: form,
      headers: {},
    });
  },

  // Projects (public)
  getProjects: () => request<Project[]>("/projects", undefined, 2, 5 * 60 * 1000),
  getProjectSummaries: () => request<ProjectSummary[]>("/projects?fields=summary", undefined, 2, 5 * 60 * 1000),
  getProjectDetail: (slug: string) => request<Project>(`/projects/${slug}`, undefined, 2, 5 * 60 * 1000),

  // Projects (admin)
  createProject: (data: ProjectCreate) => {
    invalidateCache("GET:/projects");
    invalidateCache("GET:/projects?fields=summary");
    return request<Project>("/admin/projects", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
  updateProject: (id: string, data: ProjectUpdate) => {
    invalidateCache("GET:/projects");
    invalidateCache("GET:/projects?fields=summary");
    return request<Project>(`/admin/projects/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },
  deleteProject: (id: string) => {
    invalidateCache("GET:/projects");
    invalidateCache("GET:/projects?fields=summary");
    return request<void>(`/admin/projects/${id}`, { method: "DELETE" });
  },
  reorderProjects: (ids: string[]) => {
    invalidateCache("GET:/projects");
    invalidateCache("GET:/projects?fields=summary");
    return request<void>("/admin/projects/reorder", {
      method: "PUT",
      body: JSON.stringify({ ids }),
    });
  },
  uploadProjectIcon: (id: string, file: File) => {
    invalidateCache("GET:/projects");
    invalidateCache("GET:/projects?fields=summary");
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
    request<{ user: GHUser; repos: GHRepo[] }>(`/github/${username}`, undefined, 2, 15 * 60 * 1000),
  getGithubContributions: (username: string) =>
    request<GHContributions>(`/github/${username}/contributions`, undefined, 2, 15 * 60 * 1000),

  // Blog (public)
  getBlogCategories: () => request<BlogCategory[]>("/blog/categories", undefined, 2, 10 * 60 * 1000),
  getBlogPosts: (categorySlug?: string) =>
    request<BlogPost[]>(`/blog/posts${categorySlug ? `?category=${categorySlug}` : ""}`, undefined, 2, 5 * 60 * 1000),
  getBlogPost: (id: string) => request<BlogPost>(`/blog/posts/${id}`, undefined, 2, 10 * 60 * 1000),
  getBlogComments: (postId: string) => request<BlogComment[]>(`/blog/posts/${postId}/comments`, undefined, 2, 2 * 60 * 1000),
  createBlogComment: (postId: string, data: BlogCommentCreate) => {
    invalidateCache(`GET:/blog/posts/${postId}/comments`);
    return request<BlogComment>(`/blog/posts/${postId}/comments`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  // Blog (admin)
  adminGetBlogPosts: (categorySlug?: string) =>
    request<BlogPost[]>(`/admin/blog/posts${categorySlug ? `?category=${categorySlug}` : ""}`, undefined, 2, 5 * 60 * 1000),
  createBlogCategory: (data: BlogCategoryCreate) => {
    invalidateCache("GET:/blog/categories");
    return request<BlogCategory>("/admin/blog/categories", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
  updateBlogCategory: (id: string, data: Partial<BlogCategoryCreate>) => {
    invalidateCache("GET:/blog/categories");
    return request<BlogCategory>(`/admin/blog/categories/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },
  deleteBlogCategory: (id: string) => {
    invalidateCache("GET:/blog/categories");
    return request<void>(`/admin/blog/categories/${id}`, { method: "DELETE" });
  },
  createBlogPost: (data: BlogPostCreate) => {
    invalidateCache("GET:/blog/posts");
    invalidateCache("GET:/blog/categories");
    invalidateCache("GET:/admin/blog/posts");
    return request<BlogPost>("/admin/blog/posts", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
  updateBlogPost: (id: string, data: BlogPostUpdate) => {
    invalidateCache("GET:/blog/posts");
    invalidateCache("GET:/blog/categories");
    invalidateCache("GET:/admin/blog/posts");
    invalidateCache(`GET:/blog/posts/${id}`);
    return request<BlogPost>(`/admin/blog/posts/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },
  deleteBlogPost: (id: string) => {
    invalidateCache("GET:/blog/posts");
    invalidateCache("GET:/blog/categories");
    invalidateCache("GET:/admin/blog/posts");
    invalidateCache(`GET:/blog/posts/${id}`);
    return request<void>(`/admin/blog/posts/${id}`, { method: "DELETE" });
  },
  deleteBlogComment: (postId: string, commentId: string) => {
    invalidateCache(`GET:/blog/posts/${postId}/comments`);
    return request<void>(`/admin/blog/comments/${commentId}`, { method: "DELETE" });
  },

  // Guestbook (public)
  getGuestbookMessages: () => request<GuestbookMessage[]>("/guestbook/messages", undefined, 2, 60 * 1000),
  createGuestbookMessage: (data: GuestbookMessageCreate) => {
    invalidateCache("GET:/guestbook/messages");
    return request<GuestbookMessage>("/guestbook/messages", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
  replyToGuestbookAsUser: (id: string, data: { nickname: string; content: string }) => {
    invalidateCache("GET:/guestbook/messages");
    return request<GuestbookMessage>(`/guestbook/messages/${id}/replies`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
  deleteOwnGuestbookMessage: (id: string) => {
    invalidateCache("GET:/guestbook/messages");
    return request<void>(`/guestbook/messages/${id}`, { method: "DELETE" });
  },

  // Guestbook (admin)
  replyToGuestbookMessage: (id: string, data: GuestbookReplyCreate) => {
    invalidateCache("GET:/guestbook/messages");
    return request<GuestbookMessage>(`/admin/guestbook/messages/${id}/replies`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
  deleteGuestbookMessage: (id: string) => {
    invalidateCache("GET:/guestbook/messages");
    return request<void>(`/admin/guestbook/messages/${id}`, { method: "DELETE" });
  },
  deleteGuestbookReply: (id: string) => {
    invalidateCache("GET:/guestbook/messages");
    return request<void>(`/admin/guestbook/replies/${id}`, { method: "DELETE" });
  },

  // Favorites (public)
  getFavorites: () => request<Favorite[]>("/favorites", undefined, 2, 5 * 60 * 1000),

  // Favorites (admin)
  createFavorite: (file: File, title?: string, description?: string) => {
    invalidateCache("GET:/favorites");
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
  deleteFavorite: (id: string) => {
    invalidateCache("GET:/favorites");
    return request<void>(`/admin/favorites/${id}`, { method: "DELETE" });
  },
  updateFavoritePosition: (id: string, posX: number | null, posY: number | null) => {
    invalidateCache("GET:/favorites");
    return request<void>(`/admin/favorites/${id}/position`, {
      method: "PATCH",
      body: JSON.stringify({ posX, posY }),
    });
  },
};
