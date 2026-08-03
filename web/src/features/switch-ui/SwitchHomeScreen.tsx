import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";
import { createPortal } from "react-dom";
import {
  switchHomeActions,
  switchHomeProjects,
  switchHomeUser,
  type SwitchHomeProject,
} from "./switchHomeData";
import { ProjectCard } from "./ProjectCard";
import { ActionButton } from "./ActionButton";
import { AdminPanel } from "./AdminPanel";
import { ProjectDetail } from "./ProjectDetail";
import { ProjectLibrary, ProjectLibraryButton } from "./ProjectLibrary";
import { GitHubProfile } from "./GitHubProfile";
import { BlogBookshelf } from "./BlogBookshelf";
import { MessageWallModal } from "./MessageWallModal";
import { ResumeModal } from "./ResumeModal";
import { FavoritesModal } from "./FavoritesModal";
import { SaveToast } from "./SaveToast";
import { api } from "../../api/client";
import { useAdminStore } from "../../stores/adminStore";
import { useSceneStore } from "../../stores/sceneStore";
import { useSound } from "./useSound";
import type { Project } from "../../api/types";
import { DEFAULT_SITE_PERMISSIONS, isActionAllowed } from "./entryPermissions";
import { actionIdForRoute, isSwitchModalRoute, routeForAction, type SwitchRouteState } from "./switchRoutes";
import "./switch-ui.css";

interface SwitchHomeScreenProps {
  focused: boolean;
  resetSignal: number;
  presentation?: "preview" | "fullscreen";
  onRequestFocus: () => void;
  onRequestExit: () => void;
  routeState?: SwitchRouteState;
  onNavigate?: (to: string, options?: { replace?: boolean }) => void;
}

type FocusZone = "projects" | "actions";

const MIN_PROJECT_SLOTS = 5;
const HOME_PROJECT_LIMIT = 12;
const HOME_SWITCH_ROUTE_STATE: SwitchRouteState = { kind: "home" };
const GITHUB_HOME_URL = "https://github.com/meo-blog";

function extractGithubUsername(url?: string): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (!u.hostname.includes("github.com")) return null;
    const seg = u.pathname.replace(/^\/|\/$/g, "").split("/")[0];
    return seg || null;
  } catch {
    return null;
  }
}
const ADMIN_GATE_MAX_INPUTS = 32;

type AdminGateKey = "up" | "down" | "left" | "right" | "a" | "b" | "x" | "y";

const ADMIN_GATE_CODE_PARTS: Record<AdminGateKey, string> = {
  up: "U",
  down: "D",
  left: "L",
  right: "R",
  b: "B",
  a: "A",
  x: "X",
  y: "Y",
};

function createEmptyProjectSlot(index: number): SwitchHomeProject {
  return {
    id: `empty-slot-${index + 1}`,
    title: "无",
    subtitle: "",
    category: "",
    coverLabel: "",
    icon: "empty",
    accentColor: "#4a4a4d",
  };
}

function openExternal(url?: string) {
  if (!url) return;
  window.open(url, "_blank", "noopener,noreferrer");
}


function normalizeAdminGateKey(key: string): AdminGateKey | null {
  const normalized = key.toLowerCase();

  if (normalized === "arrowup") return "up";
  if (normalized === "arrowdown") return "down";
  if (normalized === "arrowleft") return "left";
  if (normalized === "arrowright") return "right";
  if (normalized === "a" || normalized === "b" || normalized === "x" || normalized === "y") {
    return normalized;
  }

  return null;
}

export function SwitchHomeScreen({
  focused,
  resetSignal,
  presentation = "preview",
  onRequestFocus,
  onRequestExit,
  routeState = HOME_SWITCH_ROUTE_STATE,
  onNavigate,
}: SwitchHomeScreenProps) {
  const { play: playSound } = useSound();
  const navigate = useCallback((to: string, options?: { replace?: boolean }) => {
    if (onNavigate) {
      onNavigate(to, options);
      return;
    }

    if (options?.replace) {
      window.history.replaceState(null, "", to);
    } else {
      window.history.pushState(null, "", to);
    }
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, [onNavigate]);
  const playProjectHover = useCallback(() => playSound("project-hover"), [playSound]);
  const playProjectClick = useCallback(() => playSound("project-click"), [playSound]);
  const playActionHover = useCallback(() => playSound("action-hover"), [playSound]);
  const playActionClick = useCallback(() => playSound("action-click"), [playSound]);
  const projectRailRef = useRef<HTMLDivElement | null>(null);
  const adminPasswordInputRef = useRef<HTMLInputElement | null>(null);
  const adminGateCodeRef = useRef("");
  const projectDragRef = useRef({ active: false, startX: 0, startScrollLeft: 0, suppressClick: false });
  const [selectedProject, setSelectedProject] = useState(-1);
  const [hoveredProject, setHoveredProject] = useState(-1);
  const [projectDragging, setProjectDragging] = useState(false);
  const [selectedAction, setSelectedAction] = useState(-1);
  const [focusZone, setFocusZone] = useState<FocusZone>("projects");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [adminPromptOpen, setAdminPromptOpen] = useState(false);
  const [adminErrorPulse, setAdminErrorPulse] = useState(false);
  const [adminAuthStatus, setAdminAuthStatus] = useState<"idle" | "submitting" | "error">("idle");
  const [adminAuthMessage, setAdminAuthMessage] = useState("");
  const [adminPanelOpen, setAdminPanelOpen] = useState(false);
  const [sessionChecking, setSessionChecking] = useState(false);
  const [detailProject, setDetailProject] = useState<Project | SwitchHomeProject | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showProjectLibrary, setShowProjectLibrary] = useState(false);
  const [showGithub, setShowGithub] = useState(false);
  const [showBlog, setShowBlog] = useState(false);
  const [showGuestbook, setShowGuestbook] = useState(false);
  const [showResume, setShowResume] = useState(false);
  const [showFavorites, setShowFavorites] = useState(false);
  const [permissions, setPermissions] = useState(DEFAULT_SITE_PERMISSIONS);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [clock, setClock] = useState(() => new Date());

  const { authenticated: isAdminAuthenticated, setAuthenticated: setAdminAuthenticated, profile, projects: storeProjects, setProjectSummaries, setProfile } = useAdminStore();
  const setContentReady = useSceneStore((s) => s.setContentReady);
  const setIconsReady = useSceneStore((s) => s.setIconsReady);

  // Auto-clear admin auth when session expires (401 from API)
  useEffect(() => {
    function onSessionExpired() {
      setAdminAuthenticated(false);
    }
    window.addEventListener("session-expired", onSessionExpired);
    return () => window.removeEventListener("session-expired", onSessionExpired);
  }, [setAdminAuthenticated]);

  // Tier 1: load project summaries �?preload icons �?mark content ready
  // Profile loads independently (not blocking the overlay)
  useEffect(() => {
    let cancelled = false;

    const warmProjectIcons = (projects: Array<{ iconUrl?: string }>) => {
      for (const url of projects.map((p) => p.iconUrl).filter((u): u is string => !!u)) {
        const img = new Image();
        img.src = url;
      }
    };

    api.getProjectSummariesCachedFirst((projects) => {
      if (cancelled) return;
      setProjectSummaries(projects);
      warmProjectIcons(projects);
    }).then((projects) => {
      if (cancelled) return;
      setProjectSummaries(projects);
      setIconsReady();
      setContentReady();
      warmProjectIcons(projects);
    }).catch(() => {
      // API failed �?don't block the overlay forever
      if (!cancelled) {
        setIconsReady();
        setContentReady();
      }
    });
    // Profile loads in parallel, not blocking
    api.getPublicProfile().then((p) => { if (!cancelled) setProfile(p); }).catch(() => {});
    api.getPermissions().then((p) => { if (!cancelled) setPermissions(p); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    function onPermissionsUpdated(event: Event) {
      const detail = (event as CustomEvent<typeof DEFAULT_SITE_PERMISSIONS>).detail;
      if (detail) setPermissions(detail);
    }
    window.addEventListener("site-permissions-updated", onPermissionsUpdated);
    return () => window.removeEventListener("site-permissions-updated", onPermissionsUpdated);
  }, []);

  const allProjects = useMemo(() => {
    const source = storeProjects.length > 0 ? storeProjects : switchHomeProjects;
    return source.filter((project) => !project.id.startsWith("empty-"));
  }, [storeProjects]);

  const projectItems = useMemo(() => {
    const source = (storeProjects.length > 0 ? storeProjects : switchHomeProjects).slice(0, HOME_PROJECT_LIMIT);
    if (source.length >= MIN_PROJECT_SLOTS) return source;

    return [
      ...source,
      ...Array.from(
        { length: MIN_PROJECT_SLOTS - source.length },
        (_, index) => createEmptyProjectSlot(source.length + index),
      ),
    ];
  }, [storeProjects]);

  const moreProjectIndex = projectItems.length;
  const projectNavigationCount = projectItems.length + 1;
  const activeProjectIndex = hoveredProject >= 0 ? hoveredProject : selectedProject;
  const currentProject = projectItems[activeProjectIndex] ?? projectItems[0];
  const visibleActions = switchHomeActions;
  const currentAction = visibleActions[selectedAction] ?? visibleActions[0];
  const beijingNow = useMemo(() => {
    const dateText = new Intl.DateTimeFormat("zh-CN", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(clock);
    const timeText = new Intl.DateTimeFormat("zh-CN", {
      timeZone: "Asia/Shanghai",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(clock);
    const [hourText = "", minuteText = ""] = timeText.split(":");

    return {
      dateText,
      timeText,
      hourText,
      minuteText,
      tick: Math.floor(clock.getTime() / 1000),
    };
  }, [clock]);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (selectedAction >= visibleActions.length) {
      setSelectedAction(visibleActions.length > 0 ? visibleActions.length - 1 : -1);
    }
  }, [selectedAction, visibleActions.length]);

  useEffect(() => {
    if (!permissionDenied) return;
    const timer = window.setTimeout(() => setPermissionDenied(false), 1800);
    return () => window.clearTimeout(timer);
  }, [permissionDenied]);

  useEffect(() => {
    if (!isSwitchModalRoute(routeState.kind)) return;
    if (!focused) onRequestFocus();
  }, [focused, onRequestFocus, routeState.kind]);

  useEffect(() => {
    const actionId = actionIdForRoute(routeState.kind);
    if (actionId && !isAdminAuthenticated && !isActionAllowed(actionId, permissions)) {
      setPermissionDenied(false);
      window.setTimeout(() => setPermissionDenied(true), 0);
      navigate("/", { replace: true });
      return;
    }

    setShowGithub(routeState.kind === "github");
    setShowBlog(routeState.kind === "blog" || routeState.kind === "post");
    setShowGuestbook(routeState.kind === "guestbook");
    setShowResume(routeState.kind === "resume");
    setShowFavorites(routeState.kind === "favorites");
    setShowProjectLibrary(routeState.kind === "projects");

    if (routeState.kind !== "project") {
      setDetailProject(null);
      setDetailLoading(false);
    }
    if (routeState.kind === "admin") {
      void openAdminArea();
    } else {
      setAdminPanelOpen(false);
    }
  }, [isAdminAuthenticated, navigate, permissions, routeState.kind]);

  useEffect(() => {
    if (routeState.kind !== "project" || !routeState.projectId || !focused) return;
    const project = allProjects.find((item) => item.id === routeState.projectId);
    if (!project) return;
    const currentId = detailProject && "id" in detailProject ? detailProject.id : "";
    if (currentId === project.id && !detailLoading) return;
    void openProjectDetail(project);
  }, [allProjects, detailLoading, detailProject, focused, routeState.kind, routeState.projectId]);

  function closeRouteModal() {
    navigate("/");
  }

  useEffect(() => {
    setSelectedProject(0);
    setHoveredProject(-1);
    setProjectDragging(false);
    setSelectedAction(0);
    setFocusZone("projects");
    setSettingsOpen(false);
    setAdminPromptOpen(false);
    setShowProjectLibrary(false);
    resetAdminGate();
    setAdminErrorPulse(false);
    setAdminAuthStatus("idle");
    setAdminAuthMessage("");
  }, [resetSignal]);

  useEffect(() => {
    if (!focused) return;

    function onKeyDown(event: KeyboardEvent) {
      if (showGithub) {
        if (event.key === "Escape") {
          playSound("close");
          closeRouteModal();
          return;
        }
        return;
      }

      if (showBlog) {
        if (event.key === "Escape") {
          playSound("close");
          closeRouteModal();
          return;
        }
        return;
      }

      if (showGuestbook) {
        if (event.key === "Escape") {
          playSound("close");
          closeRouteModal();
          return;
        }
        return;
      }

      if (showResume) {
        if (event.key === "Escape") {
          playSound("close");
          closeRouteModal();
          return;
        }
        return;
      }

      if (showFavorites) {
        if (event.key === "Escape") {
          playSound("close");
          closeRouteModal();
          return;
        }
        return;
      }

      if (detailProject) {
        if (event.key === "Escape") {
          playSound("close");
          closeRouteModal();
          return;
        }
        return;
      }

      if (showProjectLibrary) {
        if (event.key === "Escape") {
          playSound("close");
          closeRouteModal();
        }
        return;
      }

      if (adminPromptOpen) {
        if (event.key === "Escape") {
          setAdminPromptOpen(false);
          resetAdminGate();
          setAdminAuthStatus("idle");
          setAdminAuthMessage("");
          return;
        }

        const typingPassword = event.target === adminPasswordInputRef.current;
        const gateKey = normalizeAdminGateKey(event.key);
        if (gateKey) {
          // When the password input is focused, let B/A pass through
          // so the user can type their password. Arrow keys always
          // register as gate keys (preventing cursor movement).
          if (typingPassword && (gateKey === "a" || gateKey === "b")) {
            return;
          }
          event.preventDefault();
          registerAdminGateKey(gateKey);
          return;
        }
      }

      if (event.key === "Escape") {
        setSettingsOpen(false);
        onRequestExit();
        return;
      }

      const tag = (event.target as HTMLElement)?.tagName;
      const isTyping = tag === "TEXTAREA" || tag === "INPUT" || tag === "SELECT";

      if (isTyping) return;

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        if (focusZone === "projects") {
          setSelectedProject((value) =>
            value <= 0 ? projectNavigationCount - 1 : value - 1,
          );
        } else {
          if (visibleActions.length === 0) return;
          setSelectedAction((value) =>
            value <= 0 ? visibleActions.length - 1 : value - 1,
          );
        }
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        if (focusZone === "projects") {
          setSelectedProject((value) => (value + 1) % projectNavigationCount);
        } else {
          if (visibleActions.length === 0) return;
          setSelectedAction((value) => (value + 1) % visibleActions.length);
        }
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setFocusZone("projects");
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setFocusZone("actions");
      }

      if (event.key === "Enter") {
        event.preventDefault();
        if (focusZone === "projects") {
          if (selectedProject === moreProjectIndex) {
            navigate("/projects");
          } else if (currentProject.icon !== "empty") {
            void openProjectDetail(currentProject);
          }
        } else if (currentAction) {
          activateAction(currentAction.id);
        }
      }

      if (event.key.toLowerCase() === "g") {
        event.preventDefault();
        if (selectedProject !== moreProjectIndex) openExternal(currentProject.repoUrl);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [adminPromptOpen, currentAction?.id, currentProject, detailProject, focusZone, focused, moreProjectIndex, navigate, onRequestExit, playSound, projectNavigationCount, selectedProject, showBlog, showFavorites, showGithub, showGuestbook, showProjectLibrary, showResume, visibleActions.length]);

  function resetAdminGate() {
    adminGateCodeRef.current = "";
  }

  const handleProjectPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const rail = projectRailRef.current;
    if (!rail) return;
    projectDragRef.current = { active: true, startX: event.clientX, startScrollLeft: rail.scrollLeft, suppressClick: false };
    setProjectDragging(true);
  }, []);

  const handleProjectPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const drag = projectDragRef.current;
    if (!drag.active) return;
    const deltaX = event.clientX - drag.startX;
    if (Math.abs(deltaX) >= 6) {
      drag.suppressClick = true;
    }
    if (drag.suppressClick) {
      const rail = projectRailRef.current;
      if (rail) rail.scrollLeft = drag.startScrollLeft - deltaX;
    }
  }, []);

  const handleProjectPointerUp = useCallback(() => {
    projectDragRef.current.active = false;
    setProjectDragging(false);
  }, []);

  const handleProjectClickCapture = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (projectDragRef.current.suppressClick) {
      event.preventDefault();
      event.stopPropagation();
      projectDragRef.current.suppressClick = false;
    }
  }, []);

  function triggerAdminError(message = "密码错误") {
    setAdminAuthStatus("error");
    setAdminAuthMessage(message);
    setAdminErrorPulse(false);
    window.setTimeout(() => setAdminErrorPulse(true), 0);
    window.setTimeout(() => setAdminErrorPulse(false), 420);
  }

  function registerAdminGateKey(key: AdminGateKey) {
    adminGateCodeRef.current = `${adminGateCodeRef.current}${ADMIN_GATE_CODE_PARTS[key]}`.slice(
      -ADMIN_GATE_MAX_INPUTS,
    );
  }

  async function handleAdminLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const password = adminPasswordInputRef.current?.value.trim() ?? "";
    if (!password) {
      resetAdminGate();
      triggerAdminError("密码错误");
      return;
    }

    setAdminAuthStatus("submitting");
    setAdminAuthMessage("正在校验身份...");

    try {
      await api.login(password, adminGateCodeRef.current);
      setAdminAuthMessage("身份确认，正在进入管理后�?..");
      setAdminAuthenticated(true);
      setTimeout(() => {
        setAdminPromptOpen(false);
        setAdminPanelOpen(true);
      }, 600);
    } catch (error) {
      resetAdminGate();
      triggerAdminError(error instanceof Error ? error.message : "密码错误");
    }
  }

  function openAdminPrompt() {
    setAdminPromptOpen(true);
    resetAdminGate();
    setAdminErrorPulse(false);
    setAdminAuthStatus("idle");
    setAdminAuthMessage("");
  }

  function closeAdminPrompt() {
    setAdminPromptOpen(false);
    if (adminPasswordInputRef.current) {
      adminPasswordInputRef.current.value = "";
    }
    resetAdminGate();
    setAdminErrorPulse(false);
    setAdminAuthStatus("idle");
    setAdminAuthMessage("");
  }

  async function openAdminArea() {
    if (isAdminAuthenticated) {
      setAdminPanelOpen(true);
      return;
    }

    setSessionChecking(true);
    try {
      const session = await api.checkSession();
      if (session.authenticated) {
        setAdminAuthenticated(true);
        setAdminPanelOpen(true);
        return;
      }
    } catch {
      // Fall through to password prompt when the session check is unavailable.
    } finally {
      setSessionChecking(false);
    }

    openAdminPrompt();
  }

  async function openProjectDetail(project: SwitchHomeProject) {
    if (!focused) {
      onRequestFocus();
      return;
    }
    if (project.icon === "empty" && !project.slug) return;

    setDetailProject(project);
    setDetailLoading(true);
    if (project.slug) {
      try {
        const full = await api.getProjectDetail(project.slug);
        setDetailProject(full);
      } catch {
        // Keep showing summary data when detail loading fails.
      }
    }
    setDetailLoading(false);
  }

  const activateAction = useCallback((actionId: string) => {
    if (!focused) {
      onRequestFocus();
      return;
    }

    if (!isAdminAuthenticated && !isActionAllowed(actionId, permissions)) {
      setPermissionDenied(false);
      window.setTimeout(() => setPermissionDenied(true), 0);
      return;
    }

    if (actionId === "power") {
      setSettingsOpen(false);
      setSelectedAction(-1);
      onRequestExit();
      return;
    }

    if (actionId === "github-home" && !extractGithubUsername(profile?.githubUrl)) {
      openExternal(GITHUB_HOME_URL);
      return;
    }

    if (actionId === "admin" && sessionChecking) return;

    const route = routeForAction(actionId);
    if (route) navigate(route);
  }, [focused, permissions, profile?.githubUrl, isAdminAuthenticated, sessionChecking, navigate, onRequestFocus, onRequestExit]);

  return (
    <section
      className={`switch-home-screen ${focused ? "is-focused" : "is-ambient"}`}
      data-presentation={presentation}
      aria-label="Switch 主界面"
      onClick={() => {
        if (!focused) onRequestFocus();
      }}
    >
      <div className="switch-screen-glow" />
      <header className="switch-topbar">
        <div className="switch-profile" aria-label="Profile">
          <div
            className="switch-avatar"
            role="button"
            tabIndex={0}
            style={{ cursor: "pointer" }}
            onClick={() => {
              playSound("action-click");
              if (!isAdminAuthenticated && !permissions.github) {
                setPermissionDenied(false);
                window.setTimeout(() => setPermissionDenied(true), 0);
                return;
              }
              const ghUsername = extractGithubUsername(profile?.githubUrl);
              if (ghUsername) {
                navigate("/github");
              } else {
                openExternal(GITHUB_HOME_URL);
              }
            }}
            onMouseEnter={() => playSound("action-hover")}
          >
            {profile?.avatarUrl ? (
              <img src={profile.avatarUrl} alt="" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
            ) : (
              <span>{(profile?.displayName || switchHomeUser.name).charAt(0)}</span>
            )}
          </div>
          <div className="switch-profile-info">
            <strong>{profile?.displayName || switchHomeUser.name}</strong>
            <div className="switch-profile-row">
              <svg className="switch-profile-icon" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
              </svg>
              <span>{profile?.email || switchHomeUser.email}</span>
            </div>
          </div>
        </div>

        <div className="switch-status" aria-label="Beijing date and time">
          <span className="switch-date" aria-label={beijingNow.dateText}>
            {Array.from(beijingNow.dateText).map((character, index) =>
              /\d/.test(character) ? (
                <span
                  key={`${character}-${index}`}
                  className="switch-date-digit"
                  aria-hidden="true"
                  style={{
                    "--switch-date-lift": `${-(2.4 + (index % 3) * 0.7)}px`,
                    "--switch-date-tilt": `${((index % 4) - 1.5) * 0.12}deg`,
                    animationDelay: `${-(index * 0.43)}s`,
                    animationDuration: `${3.5 + (index % 4) * 0.36}s`,
                  } as CSSProperties}
                >
                  {character}
                </span>
              ) : (
                <span key={`${character}-${index}`} className="switch-date-separator" aria-hidden="true">
                  {character}
                </span>
              ),
            )}
          </span>
          <strong className="switch-clock" aria-label={beijingNow.timeText}>
            <span
              key={`hour-${beijingNow.tick}`}
              className="switch-clock-number"
              aria-hidden="true"
            >
              {beijingNow.hourText}
            </span>
            <span className="switch-clock-separator" aria-hidden="true">
              :
            </span>
            <span
              key={`minute-${beijingNow.tick}`}
              className="switch-clock-number is-minute"
              aria-hidden="true"
            >
              {beijingNow.minuteText}
            </span>
          </strong>
        </div>
      </header>

      <main className="switch-main">
        <div
          ref={projectRailRef}
          className={`switch-project-rail ${hoveredProject >= 0 ? "has-hover" : ""} ${hoveredProject === moreProjectIndex ? "has-more-hover" : ""} ${projectDragging ? "is-dragging" : ""}`}
          role="list"
          aria-label="项目"
          onPointerDown={handleProjectPointerDown}
          onPointerMove={handleProjectPointerMove}
          onPointerUp={handleProjectPointerUp}
          onPointerCancel={handleProjectPointerUp}
          onClickCapture={handleProjectClickCapture}
        >
          <div
            className="switch-current-title"
            style={{ "--title-index": hoveredProject >= 0 ? hoveredProject : selectedProject } as CSSProperties}
          >
            <span className="switch-title-marker" />
            <div>
              <strong>{currentProject.title}</strong>
              <span>{currentProject.category}</span>
            </div>
          </div>
          {projectItems.map((project, index) => (
            <ProjectCard
              key={project.id}
              project={project}
              selected={focusZone === "projects" && hoveredProject === index}
              dragging={projectDragging}
              onSelect={() => {
                setFocusZone("projects");
                setSelectedProject(index);
                setHoveredProject(index);
              }}
              onDeselect={() => {
                setHoveredProject(-1);
              }}
              onOpen={async () => {
                navigate(`/projects/${project.id}`);
              }}
              onOpenRepo={() => openExternal(project.repoUrl)}
              onHoverSound={playProjectHover}
              onClickSound={project.icon !== "empty" ? playProjectClick : undefined}
            />
          ))}
          <ProjectLibraryButton
            selected={focusZone === "projects" && hoveredProject === moreProjectIndex}
            dragging={projectDragging}
            onSelect={() => {
              setFocusZone("projects");
              setSelectedProject(moreProjectIndex);
              setHoveredProject(moreProjectIndex);
            }}
            onDeselect={() => setHoveredProject(-1)}
            onOpen={() => {
              if (!focused) {
                onRequestFocus();
                return;
              }
              navigate("/projects");
            }}
            onHoverSound={playProjectHover}
            onClickSound={playProjectClick}
          />
        </div>
      </main>

      <nav className="switch-action-dock" aria-label="系统操作">
        {visibleActions.map((action, index) => (
          <ActionButton
            key={action.id}
            action={action}
            selected={focusZone === "actions" && selectedAction === index}
            focused={focused}
            onSelect={() => {
              setFocusZone("actions");
              setSelectedAction(index);
            }}
            onDeselect={() => {
              setSelectedAction(-1);
            }}
            onActivate={() => {
              setFocusZone("actions");
              setSelectedAction(index);
              playActionClick();
              activateAction(action.id);
            }}
            onHoverSound={playActionHover}
          />
        ))}
      </nav>

      {adminPromptOpen && (
        <aside
          className="switch-admin-terminal"
          aria-label="管理后台身份验证"
          onClick={(event) => event.stopPropagation()}
        >
          <div className={`switch-terminal-window ${adminErrorPulse ? "is-error" : ""}`}>
            <div className="switch-terminal-bar">
              <span />
              <span />
              <span />
              <strong>admin-auth.exe</strong>
              <button type="button" aria-label="关闭认证窗口" onClick={() => { closeAdminPrompt(); closeRouteModal(); }}>
                ×
              </button>
            </div>

            <form className="switch-terminal-body" onSubmit={handleAdminLogin}>
              <p>
                <span>&gt;</span> MEO_Blog secure console
              </p>
              <p>
                <span>&gt;</span> password required
              </p>
              <div className="switch-terminal-gate" aria-hidden="true">
                <div className="switch-terminal-dpad">
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => registerAdminGateKey("up")}
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => registerAdminGateKey("left")}
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => registerAdminGateKey("right")}
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => registerAdminGateKey("down")}
                  />
                </div>

                <div className="switch-terminal-face-buttons">
                  {(["x", "y", "a", "b"] as const).map((key) => (
                    <button
                      key={key}
                      type="button"
                      tabIndex={-1}
                      onClick={() => registerAdminGateKey(key)}
                    >
                      {key.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
              <label>
                <span>admin@meo:~$</span>
                <input
                  ref={adminPasswordInputRef}
                  autoFocus
                  type="password"
                  disabled={adminAuthStatus === "submitting"}
                  aria-label="管理员口令"
                  autoComplete="current-password"
                />
              </label>
              {adminAuthStatus !== "idle" && (
                <p className={`switch-terminal-status ${adminAuthStatus === "error" ? "is-error" : ""}`}>
                  <span>&gt;</span> {adminAuthMessage}
                </p>
              )}
              <div className="switch-terminal-actions">
                <button type="button" onClick={() => { closeAdminPrompt(); closeRouteModal(); }}>
                  取消
                </button>
                <button type="submit" disabled={adminAuthStatus === "submitting"}>
                  验证
                </button>
              </div>
            </form>
          </div>
        </aside>
      )}

      {settingsOpen && (
        <aside className="switch-settings-panel" aria-label="设置">
          <div>
            <strong>设置</strong>
            <button
              type="button"
              aria-label="关闭设置"
              onClick={() => setSettingsOpen(false)}
            >
              关闭
            </button>
          </div>
          <label>
            <span>画质</span>
            <strong>高</strong>
          </label>
          <label>
            <span>动效</span>
            <strong>完整</strong>
          </label>
          <label>
            <span>声音</span>
            <strong>静音</strong>
          </label>
        </aside>
      )}

      {adminPanelOpen && createPortal(
        <AdminPanel onClose={() => { playSound("close"); closeRouteModal(); }} />,
        document.body,
      )}

      {createPortal(<SaveToast />, document.body)}

      {permissionDenied && createPortal(
        <span className="switch-permission-toast">权限不足，无法访问</span>,
        document.body,
      )}

      {showProjectLibrary && (
        <ProjectLibrary
          projects={allProjects}
          onClose={() => { playSound("close"); closeRouteModal(); }}
          onOpenProject={(project) => { playProjectClick(); navigate(`/projects/${project.id}`); }}
        />
      )}

      {detailProject && createPortal(
        <ProjectDetail project={detailProject} loading={detailLoading} onClose={() => { playSound("close"); closeRouteModal(); }} />,
        document.body,
      )}

      {showGithub && (() => {
        const ghUsername = extractGithubUsername(profile?.githubUrl);
        return ghUsername ? createPortal(
          <GitHubProfile username={ghUsername} onClose={() => { playSound("close"); closeRouteModal(); }} />,
          document.body,
        ) : null;
      })()}

      {showBlog && createPortal(
        <BlogBookshelf
          initialPostId={routeState.kind === "post" ? routeState.postId : undefined}
          onOpenPost={(post) => navigate(`/posts/${post.id}`)}
          onBackToBlog={() => navigate("/blog")}
          onClose={() => { playSound("close"); closeRouteModal(); }}
        />,
        document.body,
      )}

      {showGuestbook && createPortal(
        <MessageWallModal onClose={() => { playSound("close"); closeRouteModal(); }} />,
        document.body,
      )}

      {showResume && createPortal(
        <ResumeModal onClose={() => { playSound("close"); closeRouteModal(); }} />,
        document.body,
      )}

      {showFavorites && createPortal(
        <FavoritesModal onClose={() => { playSound("close"); closeRouteModal(); }} />,
        document.body,
      )}
    </section>
  );
}
