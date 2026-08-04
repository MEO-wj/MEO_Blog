import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { api } from "./api/client";
import { setSiteFavicon } from "./app/favicon";
import "./styles/global.css";

const CHUNK_RELOAD_KEY = "meo-blog:chunk-reload-at";
const CHUNK_RELOAD_COOLDOWN_MS = 30_000;

function reloadForFreshAssets() {
  const now = Date.now();

  try {
    const lastReload = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) ?? 0);
    if (Number.isFinite(lastReload) && now - lastReload < CHUNK_RELOAD_COOLDOWN_MS) {
      return false;
    }
    sessionStorage.setItem(CHUNK_RELOAD_KEY, String(now));
  } catch {
    // Continue with the reload even when sessionStorage is unavailable.
  }

  window.location.reload();
  return true;
}

function isDynamicImportFailure(reason: unknown) {
  const message = reason instanceof Error ? reason.message : String(reason);
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Load failed/i.test(message);
}

window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  reloadForFreshAssets();
});

window.addEventListener("unhandledrejection", (event) => {
  if (!isDynamicImportFailure(event.reason)) return;
  event.preventDefault();
  reloadForFreshAssets();
});

void api.getPublicProfile(true)
  .then((profile) => setSiteFavicon(profile.avatarUrl))
  .catch(() => {
    // Keep the HTML fallback favicon when the public profile is unavailable.
  });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
