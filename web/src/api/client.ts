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

function getCache(key: string, ttlMs: number): { data: unknown; etag?: string; stale: boolean } | null {
  const entry = getCacheEntry(key);
  if (!entry) return null;
  const stale = Date.now() - entry.timestamp > ttlMs;
  return { data: entry.data, etag: entry.etag, stale };
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
  const prefix = `cache:${path}`;
  localStorage.removeItem(prefix);
  // Also remove entries with query params (e.g. /blog/posts clears /blog/posts?category=x)
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(prefix) && key !== prefix) {
      keysToRemove.push(key);
    }
  }
  for (const key of keysToRemove) localStorage.removeItem(key);
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

  // Return from cache immediately + background refresh (stale-while-revalidate)
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
  updateProfile: async (data: ProfileUpdate) => {
    const result = await request<AdminProfile>("/admin/profile", {
      method: "PUT",
      body: JSON.stringify(data),
    });
    invalidateCache("GET:/profile");
    invalidateCache("GET:/admin/profile");
    return result;
  },
  uploadAvatar: async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    const result = await request<{ url: string }>("/admin/avatar", {
      method: "POST",
      body: form,
      headers: {},
    });
    invalidateCache("GET:/profile");
    invalidateCache("GET:/admin/profile");
    return result;
  },

  // Resume
  getResume: () => request<{ url: string }>("/resume", undefined, 2, 30 * 60 * 1000),
  uploadResume: async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    const result = await request<{ url: string }>("/admin/resume", {
      method: "POST",
      body: form,
      headers: {},
    });
    invalidateCache("GET:/resume");
    invalidateCache("GET:/profile");
    invalidateCache("GET:/admin/profile");
    return result;
  },

  // Projects (public)
  getProjects: () => request<Project[]>("/projects", undefined, 2, 5 * 60 * 1000),
  getProjectSummaries: () => request<ProjectSummary[]>("/projects?fields=summary", undefined, 2, 5 * 60 * 1000),
  getProjectDetail: (slug: string) => request<Project>(`/projects/${slug}`, undefined, 2, 5 * 60 * 1000),

  // Projects (admin)
  createProject: async (data: ProjectCreate) => {
    const result = await request<Project>("/admin/projects", {
      method: "POST",
      body: JSON.stringify(data),
    });
    invalidateCache("GET:/projects");
    return result;
  },
  updateProject: async (id: string, data: ProjectUpdate) => {
    const result = await request<Project>(`/admin/projects/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
    invalidateCache("GET:/projects");
    return result;
  },
  deleteProject: async (id: string) => {
    await request<void>(`/admin/projects/${id}`, { method: "DELETE" });
    invalidateCache("GET:/projects");
  },
  reorderProjects: async (ids: string[]) => {
    await request<void>("/admin/projects/reorder", {
      method: "PUT",
      body: JSON.stringify({ ids }),
    });
    invalidateCache("GET:/projects");
  },
  uploadProjectIcon: async (id: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    const result = await request<{ url: string }>(`/admin/projects/${id}/icon`, {
      method: "POST",
      body: form,
      headers: {},
    });
    invalidateCache("GET:/projects");
    return result;
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
  createBlogComment: async (postId: string, data: BlogCommentCreate) => {
    const result = await request<BlogComment>(`/blog/posts/${postId}/comments`, {
      method: "POST",
      body: JSON.stringify(data),
    });
    invalidateCache(`GET:/blog/posts/${postId}/comments`);
    return result;
  },

  // Blog (admin)
  adminGetBlogPosts: (categorySlug?: string) =>
    request<BlogPost[]>(`/admin/blog/posts${categorySlug ? `?category=${categorySlug}` : ""}`, undefined, 2, 5 * 60 * 1000),
  createBlogCategory: async (data: BlogCategoryCreate) => {
    const result = await request<BlogCategory>("/admin/blog/categories", {
      method: "POST",
      body: JSON.stringify(data),
    });
    invalidateCache("GET:/blog/categories");
    return result;
  },
  updateBlogCategory: async (id: string, data: Partial<BlogCategoryCreate>) => {
    const result = await request<BlogCategory>(`/admin/blog/categories/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
    invalidateCache("GET:/blog/categories");
    return result;
  },
  deleteBlogCategory: async (id: string) => {
    await request<void>(`/admin/blog/categories/${id}`, { method: "DELETE" });
    invalidateCache("GET:/blog/categories");
  },
  createBlogPost: async (data: BlogPostCreate) => {
    const result = await request<BlogPost>("/admin/blog/posts", {
      method: "POST",
      body: JSON.stringify(data),
    });
    invalidateCache("GET:/blog/posts");
    invalidateCache("GET:/blog/categories");
    invalidateCache("GET:/admin/blog/posts");
    return result;
  },
  updateBlogPost: async (id: string, data: BlogPostUpdate) => {
    const result = await request<BlogPost>(`/admin/blog/posts/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
    invalidateCache("GET:/blog/posts");
    invalidateCache("GET:/blog/categories");
    invalidateCache("GET:/admin/blog/posts");
    invalidateCache(`GET:/blog/posts/${id}`);
    return result;
  },
  deleteBlogPost: async (id: string) => {
    await request<void>(`/admin/blog/posts/${id}`, { method: "DELETE" });
    invalidateCache("GET:/blog/posts");
    invalidateCache("GET:/blog/categories");
    invalidateCache("GET:/admin/blog/posts");
    invalidateCache(`GET:/blog/posts/${id}`);
  },
  deleteBlogComment: async (postId: string, commentId: string) => {
    await request<void>(`/admin/blog/comments/${commentId}`, { method: "DELETE" });
    invalidateCache(`GET:/blog/posts/${postId}/comments`);
  },

  // Guestbook (public)
  getGuestbookMessages: () => request<GuestbookMessage[]>("/guestbook/messages", undefined, 2, 60 * 1000),
  createGuestbookMessage: async (data: GuestbookMessageCreate) => {
    const result = await request<GuestbookMessage>("/guestbook/messages", {
      method: "POST",
      body: JSON.stringify(data),
    });
    invalidateCache("GET:/guestbook/messages");
    return result;
  },
  replyToGuestbookAsUser: async (id: string, data: { nickname: string; content: string }) => {
    const result = await request<GuestbookMessage>(`/guestbook/messages/${id}/replies`, {
      method: "POST",
      body: JSON.stringify(data),
    });
    invalidateCache("GET:/guestbook/messages");
    return result;
  },
  deleteOwnGuestbookMessage: async (id: string) => {
    await request<void>(`/guestbook/messages/${id}`, { method: "DELETE" });
    invalidateCache("GET:/guestbook/messages");
  },

  // Guestbook (admin)
  replyToGuestbookMessage: async (id: string, data: GuestbookReplyCreate) => {
    const result = await request<GuestbookMessage>(`/admin/guestbook/messages/${id}/replies`, {
      method: "POST",
      body: JSON.stringify(data),
    });
    invalidateCache("GET:/guestbook/messages");
    return result;
  },
  deleteGuestbookMessage: async (id: string) => {
    await request<void>(`/admin/guestbook/messages/${id}`, { method: "DELETE" });
    invalidateCache("GET:/guestbook/messages");
  },
  deleteGuestbookReply: async (id: string) => {
    await request<void>(`/admin/guestbook/replies/${id}`, { method: "DELETE" });
    invalidateCache("GET:/guestbook/messages");
  },

  // Favorites (public)
  getFavorites: () => request<Favorite[]>("/favorites", undefined, 2, 5 * 60 * 1000),

  // Favorites (admin)
  createFavorite: async (file: File, title?: string, description?: string) => {
    const form = new FormData();
    form.append("file", file);
    if (title) form.append("title", title);
    if (description) form.append("description", description);
    const result = await request<Favorite>("/admin/favorites", {
      method: "POST",
      body: form,
      headers: {},
    });
    invalidateCache("GET:/favorites");
    return result;
  },
  deleteFavorite: async (id: string) => {
    await request<void>(`/admin/favorites/${id}`, { method: "DELETE" });
    invalidateCache("GET:/favorites");
  },
  updateFavoritePosition: async (id: string, posX: number | null, posY: number | null) => {
    await request<void>(`/admin/favorites/${id}/position`, {
      method: "PATCH",
      body: JSON.stringify({ posX, posY }),
    });
    invalidateCache("GET:/favorites");
  },
};
