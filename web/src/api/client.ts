import type { APIResponse } from "./types";

const BASE_URL = import.meta.env.VITE_API_URL ?? "/api/v1";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const json: APIResponse<T> = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.data;
}

export const api = {
  getHealth: () => request<{ status: string }>("/health"),
};
