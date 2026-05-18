import type { LayoutItem } from "./types";

const MODEL_CACHE = "meo-blog-model-cache-v1";

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

export async function getCachedModelUrl(assetPath: string): Promise<string> {
  if (!("caches" in window)) return assetPath;

  const absoluteUrl = new URL(assetPath, window.location.origin).toString();
  const cache = await caches.open(MODEL_CACHE);
  const cached = await cache.match(absoluteUrl);

  if (cached) {
    return URL.createObjectURL(await cached.blob());
  }

  const response = await fetch(absoluteUrl, { cache: "force-cache" });
  if (!response.ok) {
    throw new Error(`Model request failed: ${assetPath} (${response.status})`);
  }

  await cache.put(absoluteUrl, response.clone());
  return URL.createObjectURL(await response.blob());
}
