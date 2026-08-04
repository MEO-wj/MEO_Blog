export function setSiteFavicon(avatarUrl: string) {
  if (!avatarUrl.trim()) return;

  let favicon = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
  if (!favicon) {
    favicon = document.createElement("link");
    favicon.rel = "icon";
    document.head.appendChild(favicon);
  }

  favicon.href = new URL(avatarUrl, window.location.origin).href;
}
