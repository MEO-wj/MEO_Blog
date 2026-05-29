import type { LayoutItem } from "./types";

const MODEL_CACHE = "meo-blog-model-cache-v4";
const MODEL_ASSET_VERSION = "20260524-raw-glb";
const MODEL_FETCH_CONCURRENCY = 2;
const MODEL_FETCH_TIMEOUT_MS = 20000;
const MODEL_BLOB_READ_TIMEOUT_MS = 15000;
const MODEL_BASE_URL = (import.meta.env.VITE_MODEL_BASE_URL ?? "").trim().replace(/\/$/, "");
let activeModelFetches = 0;
const modelFetchQueue: Array<() => void> = [];

const PATH_OVERRIDES: Record<string, string> = {
  "ps5-console": "/model/PS5/ps5-console.glb",
  "dualsense-controller": "/model/PS5/dualsense-controller.glb",
  "nintendo-switch-handheld-split": "/model/Switch/nintendo_switch_handheld_split.glb",
  "nintendo-switch-dock-set-split": "/model/Switch/nintendo_switch_dock_set_split.glb",
  "sci-fi-table": "/model/Scene/sci-fi_table.glb",
  "sofa": "/model/Scene/sofa.glb",
  "trestle2": "/model/Scene/trestle2.glb",
  "karaoke-piranha-plant": "/model/Scene/karaoke_piranha_plant.glb",
  "small-cabinet-right-gray": "/model/Scene/small_cabinet_right_gray.glb",
};

export function resolveAssetPath(item: LayoutItem): string {
  if (PATH_OVERRIDES[item.id]) return PATH_OVERRIDES[item.id];

  return item.path
    .replace(/^\/public\/models\/ps5\//i, "/model/PS5/")
    .replace(/^\/public\/models\/Switch\//, "/model/Switch/")
    .replace(/^\/public\/models\/Scene\//, "/model/Scene/")
    .replace(/^\/public\/models\//, "/model/");
}

interface ModelUrlOptions {
  forceRefresh?: boolean;
}

function modelCacheKey(assetPath: string): string {
  const absolute = new URL(assetPath, MODEL_BASE_URL || window.location.origin);
  absolute.searchParams.set("v", MODEL_ASSET_VERSION);
  return absolute.toString();
}

async function fetchWithTimeout(url: string, cache: RequestCache): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), MODEL_FETCH_TIMEOUT_MS);

  try {
    return await fetch(url, {
      cache,
      signal: controller.signal,
    });
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function fetchWithRetry(url: string, cache: RequestCache, retries = 2): Promise<Response> {
  let lastError: unknown;

  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetchWithTimeout(url, cache);
      if (res.ok) return res;
      if (res.status === 404) break;
      lastError = new Error(`HTTP ${res.status}`);
      if (i < retries - 1) await delay(1000 * Math.pow(2, i));
    } catch (err) {
      lastError = err;
      if (err instanceof DOMException && err.name === "AbortError" && i === retries - 1) {
        throw new Error(`Timed out while loading model: ${url}`);
      }
      if (i < retries - 1) await delay(1000 * Math.pow(2, i));
    }
  }

  const reason = lastError instanceof Error ? lastError.message : "network request failed";
  throw new Error(`Failed after ${retries} retries: ${reason}`);
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function readBlobWithTimeout(source: Response | Blob, timeoutMs: number): Promise<Blob> {
  // If source is already a Blob (from Cache API), just return it
  if (source instanceof Blob) return Promise.resolve(source);

  return new Promise<Blob>((resolve, reject) => {
    const timeoutId = setTimeout(() => reject(new Error("blob read timed out")), timeoutMs);
    source.blob().then(
      (blob) => { clearTimeout(timeoutId); resolve(blob); },
      (err) => { clearTimeout(timeoutId); reject(err); },
    );
  });
}

async function withModelFetchSlot<T>(task: () => Promise<T>): Promise<T> {
  if (activeModelFetches >= MODEL_FETCH_CONCURRENCY) {
    await new Promise<void>((resolve) => modelFetchQueue.push(resolve));
  }

  activeModelFetches++;
  try {
    return await task();
  } finally {
    activeModelFetches--;
    modelFetchQueue.shift()?.();
  }
}

export async function evictCachedModel(assetPath: string): Promise<void> {
  if (!("caches" in window)) return;
  const cache = await caches.open(MODEL_CACHE);
  await cache.delete(modelCacheKey(assetPath));
}

export async function getCachedModelUrl(assetPath: string, options: ModelUrlOptions = {}): Promise<string> {
  const absoluteUrl = modelCacheKey(assetPath);

  if (!("caches" in window)) return absoluteUrl;

  const cache = await caches.open(MODEL_CACHE);
  if (options.forceRefresh) {
    await cache.delete(absoluteUrl);
  }

  const cached = await cache.match(absoluteUrl);

  if (cached) {
    const cachedBlob = await readBlobWithTimeout(cached, MODEL_BLOB_READ_TIMEOUT_MS);
    if (cachedBlob.size > 0) {
      return URL.createObjectURL(cachedBlob);
    }
    await cache.delete(absoluteUrl);
  }

  const response = await withModelFetchSlot(() =>
    fetchWithRetry(absoluteUrl, options.forceRefresh ? "reload" : "default"),
  );
  const blob = await readBlobWithTimeout(response, MODEL_BLOB_READ_TIMEOUT_MS);
  if (blob.size === 0) {
    throw new Error(`Empty model response: ${assetPath}`);
  }

  await cache.put(absoluteUrl, new Response(blob, {
    headers: {
      "Content-Type": response.headers.get("Content-Type") ?? "model/gltf-binary",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  }));
  return URL.createObjectURL(blob);
}
