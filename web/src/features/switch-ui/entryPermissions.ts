import type { SitePermissions } from "../../api/types";

export const DEFAULT_SITE_PERMISSIONS: SitePermissions = {
  github: true,
  resume: true,
  guestbook: true,
  blog: true,
  favorites: true,
};

export type SitePermissionKey = keyof SitePermissions;

export function actionPermissionKey(actionId: string): SitePermissionKey | null {
  switch (actionId) {
    case "github-home":
      return "github";
    case "resume":
      return "resume";
    case "contact":
      return "guestbook";
    case "blog":
      return "blog";
    case "favorites":
      return "favorites";
    default:
      return null;
  }
}

export function isActionAllowed(actionId: string, permissions: SitePermissions): boolean {
  const key = actionPermissionKey(actionId);
  return key ? permissions[key] : true;
}
