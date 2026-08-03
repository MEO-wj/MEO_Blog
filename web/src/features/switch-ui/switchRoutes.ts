export type SwitchRouteKind =
  | "home"
  | "github"
  | "blog"
  | "post"
  | "guestbook"
  | "resume"
  | "favorites"
  | "admin"
  | "projects"
  | "project";

export interface SwitchRouteState {
  kind: SwitchRouteKind;
  postId?: string;
  projectId?: string;
}

function segment(value: string) {
  return value.split("?")[0].split("#")[0].replace(/^\/+|\/+$/g, "");
}

export function getSwitchRouteState(pathname: string): SwitchRouteState {
  const parts = segment(pathname).split("/").filter(Boolean);
  const [root, id] = parts;

  if (!root) return { kind: "home" };
  if (root === "github") return { kind: "github" };
  if (root === "blog") return { kind: "blog" };
  if (root === "posts") return id ? { kind: "post", postId: id } : { kind: "blog" };
  if (root === "guestbook") return { kind: "guestbook" };
  if (root === "resume") return { kind: "resume" };
  if (root === "favorites") return { kind: "favorites" };
  if (root === "admin") return { kind: "admin" };
  if (root === "projects") return id ? { kind: "project", projectId: id } : { kind: "projects" };

  return { kind: "home" };
}

export function actionIdForRoute(kind: SwitchRouteKind) {
  switch (kind) {
    case "github":
      return "github-home";
    case "blog":
    case "post":
      return "blog";
    case "guestbook":
      return "contact";
    case "resume":
      return "resume";
    case "favorites":
      return "favorites";
    default:
      return "";
  }
}

export function routeForAction(actionId: string) {
  switch (actionId) {
    case "github-home":
      return "/github";
    case "favorites":
      return "/favorites";
    case "blog":
      return "/blog";
    case "contact":
      return "/guestbook";
    case "resume":
      return "/resume";
    case "admin":
      return "/admin";
    default:
      return "";
  }
}

export function isSwitchModalRoute(kind: SwitchRouteKind) {
  return kind !== "home";
}