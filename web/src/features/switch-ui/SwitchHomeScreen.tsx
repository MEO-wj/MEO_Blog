import {
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
  type SwitchHomeAction,
  type SwitchHomeProject,
} from "./switchHomeData";
import { AdminPanel } from "./AdminPanel";
import { ProjectDetail } from "./ProjectDetail";
import { GitHubProfile } from "./GitHubProfile";
import { BlogBookshelf } from "./BlogBookshelf";
import { MessageWallModal } from "./MessageWallModal";
import { ResumeModal } from "./ResumeModal";
import { FavoritesModal } from "./FavoritesModal";
import { api } from "../../api/client";
import { useAdminStore } from "../../stores/adminStore";
import { useSound } from "./useSound";
import type { Project } from "../../api/types";
import "./switch-ui.css";

interface SwitchHomeScreenProps {
  focused: boolean;
  resetSignal: number;
  presentation?: "preview" | "fullscreen";
  onRequestFocus: () => void;
  onRequestExit: () => void;
}

type FocusZone = "projects" | "actions";
type IconName =
  | SwitchHomeAction["icon"]
  | "home"
  | "posts"
  | "repo"
  | "lab"
  | "profile"
  | "settings";

const MIN_PROJECT_SLOTS = 5;
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

function goToRoute(route?: string) {
  if (!route) return;
  window.location.href = route;
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

async function requestAdminLogin(password: string, sequence: string) {
  const response = await fetch("/api/v1/admin/login", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ password, sequence }),
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const msg = payload?.error?.message || "密码错误";
    throw new Error(msg);
  }

  return payload?.data as { expiresAt?: string };
}

function Icon({ name }: { name: IconName }) {
  switch (name) {
    case "favorite":
      return (
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <path d="m16 5 3.2 6.5 7.2 1-5.2 5.1 1.2 7.2L16 21.4l-6.4 3.4 1.2-7.2-5.2-5.1 7.2-1z" />
          <path d="M9.5 27.5h13" />
        </svg>
      );
    case "home":
      return (
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <path d="M5 15.5 16 5.5l11 10" />
          <path d="M8.5 14V26h15V14" />
          <path d="M13 26v-6h6v6" />
        </svg>
      );
    case "posts":
      return (
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <path d="M8 5h13l3 3v17H8z" />
          <path d="M12 12h8" />
          <path d="M12 17h8" />
          <path d="M12 22h5" />
        </svg>
      );
    case "repo":
      return (
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <path d="M9 6h14v18H9z" />
          <path d="M9 10h14" />
          <path d="M13 15h6" />
          <path d="M13 20h6" />
        </svg>
      );
    case "resume":
      return (
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <path d="M9 5h10l4 4v18H9z" />
          <path d="M19 5v5h5" />
          <circle cx="16" cy="15" r="3" />
          <path d="M11.5 23a5 5 0 0 1 9 0" />
        </svg>
      );
    case "blog":
      return (
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <path d="M7 6h18v20H7z" />
          <path d="M11 11h10" />
          <path d="M11 16h7" />
          <path d="M11 21h5" />
          <path d="m21 20 4-4 2 2-4 4-3 1z" />
        </svg>
      );
    case "contact":
      return (
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <path d="M5 9h22v15H5z" />
          <path d="m6 10 10 8 10-8" />
          <path d="M10 24v3" />
          <path d="M22 24v3" />
        </svg>
      );
    case "admin":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12.3 2h-.6a2 2 0 0 0-2 2v.3a2 2 0 0 1-1 1.7l-.4.2a2 2 0 0 1-2 0l-.3-.1a2 2 0 0 0-2.7.7L3 7.3A2 2 0 0 0 3.7 10l.3.2a2 2 0 0 1 1 1.7v.3a2 2 0 0 1-1 1.7l-.3.2A2 2 0 0 0 3 16.8l.3.5A2 2 0 0 0 6 18l.3-.1a2 2 0 0 1 2 0l.4.2a2 2 0 0 1 1 1.7v.2a2 2 0 0 0 2 2h.6a2 2 0 0 0 2-2v-.2a2 2 0 0 1 1-1.7l.4-.2a2 2 0 0 1 2 0l.3.1a2 2 0 0 0 2.7-.7l.3-.5a2 2 0 0 0-.7-2.7l-.3-.2a2 2 0 0 1-1-1.7v-.3a2 2 0 0 1 1-1.7l.3-.2a2 2 0 0 0 .7-2.7l-.3-.5a2 2 0 0 0-2.7-.7l-.3.1a2 2 0 0 1-2 0l-.4-.2a2 2 0 0 1-1-1.7V4a2 2 0 0 0-2-2z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
    case "lab":
      return (
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <path d="M13 5h6" />
          <path d="M14.5 5v6.5l-6.5 10a2.5 2.5 0 0 0 2.1 4h12.8a2.5 2.5 0 0 0 2.1-4l-6.5-10V5" />
          <path d="M11 21.5h10" />
        </svg>
      );
    case "profile":
      return (
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <circle cx="16" cy="11" r="5" />
          <path d="M6 27a10 10 0 0 1 20 0" />
        </svg>
      );
    case "settings":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12.3 2h-.6a2 2 0 0 0-2 2v.3a2 2 0 0 1-1 1.7l-.4.2a2 2 0 0 1-2 0l-.3-.1a2 2 0 0 0-2.7.7L3 7.3A2 2 0 0 0 3.7 10l.3.2a2 2 0 0 1 1 1.7v.3a2 2 0 0 1-1 1.7l-.3.2A2 2 0 0 0 3 16.8l.3.5A2 2 0 0 0 6 18l.3-.1a2 2 0 0 1 2 0l.4.2a2 2 0 0 1 1 1.7v.2a2 2 0 0 0 2 2h.6a2 2 0 0 0 2-2v-.2a2 2 0 0 1 1-1.7l.4-.2a2 2 0 0 1 2 0l.3.1a2 2 0 0 0 2.7-.7l.3-.5a2 2 0 0 0-.7-2.7l-.3-.2a2 2 0 0 1-1-1.7v-.3a2 2 0 0 1 1-1.7l.3-.2a2 2 0 0 0 .7-2.7l-.3-.5a2 2 0 0 0-2.7-.7l-.3.1a2 2 0 0 1-2 0l-.4-.2a2 2 0 0 1-1-1.7V4a2 2 0 0 0-2-2z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
    case "power":
      return (
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <path d="M16 4v11" />
          <path d="M9.5 8.5a10 10 0 1 0 13 0" />
        </svg>
      );
    case "github":
      return (
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <path d="M10.5 25.5c-3.5 1.2-3.5-1.5-5-2.5" />
          <path d="M21.5 29v-4.5c0-1.2.3-2-.6-2.8 3-.4 6.1-1.5 6.1-6.5 0-1.5-.5-2.8-1.4-3.8.1-.4.6-1.9-.1-3.8 0 0-1.2-.4-4 1.4a14 14 0 0 0-7.2 0c-2.8-1.8-4-1.4-4-1.4-.7 1.9-.2 3.4-.1 3.8-.9 1-1.4 2.3-1.4 3.8 0 5 3.1 6.1 6.1 6.5-.5.4-.8 1.1-.9 2.1V29" />
        </svg>
      );
  }
}

function ProjectCard({
  project,
  selected,
  dragging,
  onSelect,
  onDeselect,
  onOpen,
  onOpenRepo,
  onHoverSound,
  onClickSound,
}: {
  project: SwitchHomeProject;
  selected: boolean;
  dragging: boolean;
  onSelect: () => void;
  onDeselect: () => void;
  onOpen: () => void;
  onOpenRepo: () => void;
  onHoverSound?: () => void;
  onClickSound?: () => void;
}) {
  const cardStyle = {
    "--project-accent": project.accentColor,
  } as CSSProperties;

  return (
    <article
      className={`switch-project-card ${selected ? "is-hovered" : ""}`}
      style={cardStyle}
      aria-label={project.title}
      aria-current={selected}
      onMouseEnter={() => {
        if (!dragging) {
          onSelect();
          onHoverSound?.();
        }
      }}
      onMouseLeave={() => {
        if (!dragging) onDeselect();
      }}
      onClick={(e) => {
        console.log("[ProjectCard] click:", project.title, "target:", (e.target as HTMLElement).className);
        onClickSound?.();
        onOpen();
      }}
    >
      <div className={`switch-project-cover ${project.iconUrl ? "has-custom-icon" : ""}`} data-icon={project.icon ?? "empty"}>
        <span className="switch-project-art" aria-hidden="true">
          {project.iconUrl ? (
            <img src={project.iconUrl} alt="" className="switch-project-custom-icon" draggable="false" loading="lazy" />
          ) : (
            <span>{project.coverLabel}</span>
          )}
        </span>
      </div>
      <div className="switch-project-meta">
        <span className="switch-project-title">{project.title}</span>
        <span className="switch-project-subtitle">{project.subtitle}</span>
      </div>
      <button
        className="switch-repo-button"
        type="button"
        aria-label={`${project.title} 仓库`}
        disabled={!project.repoUrl}
        onClick={(event) => {
          event.stopPropagation();
          onSelect();
          onOpenRepo();
        }}
      >
        <Icon name="github" />
      </button>
      {project.status === "soon" && <span className="switch-project-badge">即将推出</span>}
    </article>
  );
}

function ActionButton({
  action,
  selected,
  onSelect,
  onDeselect,
  onActivate,
  focused,
  onHoverSound,
}: {
  action: SwitchHomeAction;
  selected: boolean;
  focused: boolean;
  onSelect: () => void;
  onDeselect: () => void;
  onActivate: () => void;
  onHoverSound?: () => void;
}) {
  const style = {
    "--action-accent": action.accentColor,
  } as CSSProperties;

  return (
    <button
      className={`switch-action-button ${selected ? "is-hovered" : ""}`}
      style={style}
      type="button"
      aria-label={action.label}
      data-action-label={action.label}
      onMouseEnter={() => {
        if (focused) {
          onSelect();
          onHoverSound?.();
        }
      }}
      onMouseLeave={() => {
        if (focused) onDeselect();
      }}
      onClick={onActivate}
    >
      <Icon name={action.icon} />
    </button>
  );
}

export function SwitchHomeScreen({
  focused,
  resetSignal,
  presentation = "preview",
  onRequestFocus,
  onRequestExit,
}: SwitchHomeScreenProps) {
  const { play: playSound } = useSound();
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
  const [detailProject, setDetailProject] = useState<Project | SwitchHomeProject | null>(null);
  const [showGithub, setShowGithub] = useState(false);
  const [showBlog, setShowBlog] = useState(false);
  const [showGuestbook, setShowGuestbook] = useState(false);
  const [showResume, setShowResume] = useState(false);
  const [showFavorites, setShowFavorites] = useState(false);
  const [clock, setClock] = useState(() => new Date());

  const { authenticated: isAdminAuthenticated, setAuthenticated: setAdminAuthenticated, profile, projects: storeProjects, setProjectSummaries, setProfile } = useAdminStore();

  const [dataRetryCount, setDataRetryCount] = useState(0);

  useEffect(() => {
    api.getProjectSummaries().then((p) => setProjectSummaries(p)).catch(() => {});
    api.getPublicProfile().then((p) => setProfile(p)).catch(() => {});
    api.checkSession().then((s) => {
      if (s.authenticated) setAdminAuthenticated(true);
    }).catch(() => {});
  }, [dataRetryCount]);

  // Auto-retry once after 5s if data is still empty
  useEffect(() => {
    if (dataRetryCount > 0) return;
    const t = setTimeout(() => {
      if (storeProjects.length === 0 && !profile) {
        setDataRetryCount(1);
      }
    }, 5000);
    return () => clearTimeout(t);
  }, [dataRetryCount, storeProjects.length, profile]);

  const projectItems = useMemo(() => {
    const source = storeProjects.length > 0 ? storeProjects : switchHomeProjects;
    if (source.length >= MIN_PROJECT_SLOTS) return source;

    return [
      ...source,
      ...Array.from(
        { length: MIN_PROJECT_SLOTS - source.length },
        (_, index) => createEmptyProjectSlot(source.length + index),
      ),
    ];
  }, [storeProjects]);

  const currentProject = projectItems[selectedProject] ?? projectItems[0];
  const currentAction = switchHomeActions[selectedAction] ?? switchHomeActions[0];
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

    return { dateText, timeText };
  }, [clock]);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setSelectedProject(0);
    setHoveredProject(-1);
    setProjectDragging(false);
    setSelectedAction(0);
    setFocusZone("projects");
    setSettingsOpen(false);
    setAdminPromptOpen(false);
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
          setShowGithub(false);
          return;
        }
        return;
      }

      if (showBlog) {
        if (event.key === "Escape") {
          playSound("close");
          setShowBlog(false);
          return;
        }
        return;
      }

      if (showGuestbook) {
        if (event.key === "Escape") {
          playSound("close");
          setShowGuestbook(false);
          return;
        }
        return;
      }

      if (showResume) {
        if (event.key === "Escape") {
          playSound("close");
          setShowResume(false);
          return;
        }
        return;
      }

      if (showFavorites) {
        if (event.key === "Escape") {
          playSound("close");
          setShowFavorites(false);
          return;
        }
        return;
      }

      if (detailProject) {
        if (event.key === "Escape") {
          playSound("close");
          setDetailProject(null);
          return;
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
            value === 0 ? projectItems.length - 1 : value - 1,
          );
        } else {
          setSelectedAction((value) =>
            value === 0 ? switchHomeActions.length - 1 : value - 1,
          );
        }
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        if (focusZone === "projects") {
          setSelectedProject((value) => (value + 1) % projectItems.length);
        } else {
          setSelectedAction((value) => (value + 1) % switchHomeActions.length);
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
          goToRoute(currentProject.route);
        } else {
          activateAction(currentAction.id);
        }
      }

      if (event.key.toLowerCase() === "g") {
        event.preventDefault();
        openExternal(currentProject.repoUrl);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [adminPromptOpen, currentAction.id, currentProject, detailProject, focusZone, focused, onRequestExit, playSound, projectItems.length, showBlog, showFavorites, showGithub, showGuestbook, showResume]);

  function resetAdminGate() {
    adminGateCodeRef.current = "";
  }

  function handleProjectPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    const rail = projectRailRef.current;
    if (!rail) return;
    projectDragRef.current = { active: true, startX: event.clientX, startScrollLeft: rail.scrollLeft, suppressClick: false };
    setProjectDragging(true);
  }

  function handleProjectPointerMove(event: React.PointerEvent<HTMLDivElement>) {
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
  }

  function handleProjectPointerUp() {
    projectDragRef.current.active = false;
    setProjectDragging(false);
  }

  function handleProjectClickCapture(event: React.MouseEvent<HTMLDivElement>) {
    if (projectDragRef.current.suppressClick) {
      event.preventDefault();
      event.stopPropagation();
      projectDragRef.current.suppressClick = false;
    }
  }

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
    console.log("[admin-gate] key:", key, "-> code:", adminGateCodeRef.current);
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
    console.log("[admin-login] password:", password, "sequence:", adminGateCodeRef.current);

    try {
      await requestAdminLogin(password, adminGateCodeRef.current);
      setAdminAuthMessage("身份确认，正在进入管理后台...");
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

  function activateAction(actionId: string) {
    if (!focused) {
      onRequestFocus();
      return;
    }

    if (actionId === "power") {
      setSettingsOpen(false);
      setSelectedAction(-1);
      onRequestExit();
      return;
    }

    if (actionId === "github-home") {
      const ghUsername = extractGithubUsername(profile?.githubUrl);
      if (ghUsername) {
        setShowGithub(true);
      } else {
        openExternal(GITHUB_HOME_URL);
      }
      return;
    }

    if (actionId === "favorites") {
      setShowFavorites(true);
      return;
    }

    if (actionId === "admin") {
      if (isAdminAuthenticated) {
        setAdminPanelOpen(true);
      } else {
        openAdminPrompt();
      }
      return;
    }

    if (actionId === "blog") {
      setShowBlog(true);
      return;
    }

    if (actionId === "contact") {
      setShowGuestbook(true);
      return;
    }

    if (actionId === "resume") {
      setShowResume(true);
      return;
    }

    const routes: Record<string, string> = {
    };

    if (routes[actionId]) {
      goToRoute(routes[actionId]);
    }
  }

  return (
    <section
      className={`switch-home-screen ${focused ? "is-focused" : "is-ambient"}`}
      data-presentation={presentation}
      aria-label="Switch 主界面"
      onClick={(e) => {
        console.log("[SwitchHome] section click, focused:", focused, "target:", (e.target as HTMLElement).className);
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
              const ghUsername = extractGithubUsername(profile?.githubUrl);
              if (ghUsername) {
                setShowGithub(true);
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
          <span>{beijingNow.dateText}</span>
          <strong>{beijingNow.timeText}</strong>
        </div>
      </header>

      <main className="switch-main">
        <div
          ref={projectRailRef}
          className={`switch-project-rail ${hoveredProject >= 0 ? "has-hover" : ""} ${projectDragging ? "is-dragging" : ""}`}
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
                if (project.icon === "empty") return;
                if (project.slug) {
                  try {
                    const full = await api.getProjectDetail(project.slug);
                    setDetailProject(full);
                    return;
                  } catch { /* fall through to show summary */ }
                }
                setDetailProject(project);
              }}
              onOpenRepo={() => openExternal(project.repoUrl)}
              onHoverSound={() => playSound("project-hover")}
              onClickSound={() => {
                if (project.icon !== "empty") playSound("project-click");
              }}
            />
          ))}
        </div>
      </main>

      <nav className="switch-action-dock" aria-label="系统操作">
        {switchHomeActions.map((action, index) => (
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
              playSound("action-click");
              activateAction(action.id);
            }}
            onHoverSound={() => playSound("action-hover")}
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
              <button type="button" aria-label="关闭认证窗口" onClick={closeAdminPrompt}>
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
                <button type="button" onClick={closeAdminPrompt}>
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
        <AdminPanel onClose={() => { playSound("close"); setAdminPanelOpen(false); }} />,
        document.body,
      )}

      {detailProject && createPortal(
        <ProjectDetail project={detailProject} onClose={() => { playSound("close"); setDetailProject(null); }} />,
        document.body,
      )}

      {showGithub && (() => {
        const ghUsername = extractGithubUsername(profile?.githubUrl);
        return ghUsername ? createPortal(
          <GitHubProfile username={ghUsername} onClose={() => { playSound("close"); setShowGithub(false); }} />,
          document.body,
        ) : null;
      })()}

      {showBlog && createPortal(
        <BlogBookshelf onClose={() => { playSound("close"); setShowBlog(false); }} />,
        document.body,
      )}

      {showGuestbook && createPortal(
        <MessageWallModal onClose={() => { playSound("close"); setShowGuestbook(false); }} />,
        document.body,
      )}

      {showResume && createPortal(
        <ResumeModal onClose={() => { playSound("close"); setShowResume(false); }} />,
        document.body,
      )}

      {showFavorites && createPortal(
        <FavoritesModal onClose={() => { playSound("close"); setShowFavorites(false); }} />,
        document.body,
      )}
    </section>
  );
}
