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
  techStack: string[];
  pinned: boolean;
}

export interface Devlog {
  id: string;
  title: string;
  projectSlug: string;
  contentMd: string;
  createdAt: string;
}
