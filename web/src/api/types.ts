export interface APIResponse<T> {
  data: T;
  meta: { requestId: string; cached?: boolean };
  error: APIError | null;
}

export interface APIError {
  code: string;
  message: string;
  fields?: Record<string, string>;
}

export interface PaginatedMeta {
  page: number;
  pageSize: number;
  total: number;
  hasNext: boolean;
}

export interface Post {
  id: string;
  slug: string;
  title: string;
  summary: string;
  coverUrl: string;
  tags: string[];
  publishedAt: string;
}

export interface Game {
  id: string;
  slug: string;
  title: string;
  platform: string;
  coverUrl: string;
  playStatus: string;
  rating: number;
  hoursPlayed: number;
  reviewMd: string;
}

export interface Project {
  id: string;
  name: string;
  slug: string;
  description: string;
  repoUrl: string;
  demoUrl: string;
  coverUrl: string;
  iconUrl: string;
  accentColor: string;
  category: string;
  status: string;
  techStack: string[];
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminProfile {
  displayName: string;
  email: string;
  bio: string;
  avatarUrl: string;
  phone: string;
  province: string;
  city: string;
  extraEmails: string[];
  githubUrl: string;
}

export interface ProfileUpdate {
  displayName?: string;
  email?: string;
  bio?: string;
  phone?: string;
  province?: string;
  city?: string;
  extraEmails?: string[];
  githubUrl?: string;
}

export interface ProjectCreate {
  name: string;
  slug: string;
  description: string;
  repoUrl: string;
  iconUrl: string;
  accentColor: string;
  category: string;
  status: string;
}

export type ProjectUpdate = Partial<ProjectCreate>;

export interface Devlog {
  id: string;
  title: string;
  projectSlug: string;
  contentMd: string;
  createdAt: string;
}

export interface GHUser {
  login: string;
  name: string | null;
  avatar_url: string;
  bio: string | null;
  location: string | null;
  email: string | null;
  public_repos: number;
  followers: number;
  following: number;
  html_url: string;
}

export interface GHRepo {
  id: number;
  name: string;
  description: string | null;
  stargazers_count: number;
  forks_count: number;
  language: string | null;
  html_url: string;
  updated_at: string;
}

export interface GHContributions {
  contributions: { date: string; count: number; level: number }[];
  totalContributions: number;
}
