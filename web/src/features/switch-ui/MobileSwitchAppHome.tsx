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
import { api } from "../../api/client";
import type { Project } from "../../api/types";
import { useAdminStore } from "../../stores/adminStore";
import { AdminPanel } from "./AdminPanel";
import { GitHubProfile } from "./GitHubProfile";
import { Icon, type IconName } from "./Icon";
import { MessageWallModal } from "./MessageWallModal";
import { MobileActionDock } from "./MobileActionDock";
import { ProjectDetail } from "./ProjectDetail";
import { ResumeModal } from "./ResumeModal";
import { SaveToast } from "./SaveToast";
import {
  switchHomeActions,
  switchHomeProjects,
  switchHomeUser,
  type SwitchHomeProject,
} from "./switchHomeData";
import { useSound } from "./useSound";
import "./switch-ui.css";
import "./mobile-switch-app.css";

const GITHUB_HOME_URL = "https://github.com/meo-blog";
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

const MOBILE_DOCK_ACTION_IDS = ["github-home", "resume", "contact"];
const MOBILE_SPACE_ACTION_IDS = ["github-home", "resume", "contact"];
const MOBILE_PROJECT_SKELETON_COUNT = 4;

const MOBILE_ACTION_LABELS: Record<string, string> = {
  "github-home": "GitHub",
  resume: "简历",
  contact: "留言",
  admin: "管理后台",
  power: "回到顶部",
};

const MOBILE_ACTION_SUBTITLES: Record<string, string> = {
  "github-home": "代码主页",
  resume: "个人履历",
  contact: "留言墙",
};

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

function openExternal(url?: string) {
  if (!url) return;
  window.open(url, "_blank", "noopener,noreferrer");
}

function isRealProject(project: SwitchHomeProject) {
  return !project.id.startsWith("empty");
}

export function MobileSwitchAppHome() {
  const { play: playSound } = useSound();
  const passwordInputRef = useRef<HTMLInputElement | null>(null);
  const adminGateCodeRef = useRef("");
  const detailRequestRef = useRef(0);
  const pageRef = useRef<HTMLElement | null>(null);
  const projectStripRef = useRef<HTMLDivElement | null>(null);

  const {
    authenticated: isAdminAuthenticated,
    profile,
    projects: storeProjects,
    partners,
    setAuthenticated: setAdminAuthenticated,
    setPartners,
    setProfile,
    setProjectSummaries,
  } = useAdminStore();

  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [detailProject, setDetailProject] = useState<Project | SwitchHomeProject | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showGithub, setShowGithub] = useState(false);
  const [showGuestbook, setShowGuestbook] = useState(false);
  const [showResume, setShowResume] = useState(false);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const [adminPromptOpen, setAdminPromptOpen] = useState(false);
  const [adminPanelOpen, setAdminPanelOpen] = useState(false);
  const [adminAuthStatus, setAdminAuthStatus] = useState<"idle" | "submitting" | "error">("idle");
  const [adminAuthMessage, setAdminAuthMessage] = useState("");
  const [sessionChecking, setSessionChecking] = useState(false);
  const [projectsLoading, setProjectsLoading] = useState(true);

  useEffect(() => {
    function onSessionExpired() {
      setAdminAuthenticated(false);
    }
    window.addEventListener("session-expired", onSessionExpired);
    return () => window.removeEventListener("session-expired", onSessionExpired);
  }, [setAdminAuthenticated]);

  useEffect(() => {
    let cancelled = false;

    api.getProjectSummariesCachedFirst((projects) => {
      if (!cancelled) setProjectSummaries(projects);
    })
      .then((projects) => {
        if (!cancelled) setProjectSummaries(projects);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setProjectsLoading(false);
      });

    api.getPublicProfile()
      .then((p) => {
        if (!cancelled) setProfile(p);
      })
      .catch(() => {});

    api.getPartners()
      .then((p) => {
        if (!cancelled) setPartners(p);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [setPartners, setProfile, setProjectSummaries]);

  const projectItems = useMemo(() => {
    const source = storeProjects.length > 0 ? storeProjects : switchHomeProjects;
    return source.filter(isRealProject);
  }, [storeProjects]);

  useEffect(() => {
    setSelectedProjectId((current) => {
      if (projectItems.length === 0) return "";
      if (projectItems.some((project) => project.id === current)) return current;
      return projectItems[0].id;
    });
  }, [projectItems]);

  useEffect(() => {
    projectStripRef.current?.scrollTo({ left: 0 });
  }, [projectItems]);

  const dockActions = useMemo(
    () => MOBILE_DOCK_ACTION_IDS
      .map((id) => switchHomeActions.find((action) => action.id === id))
      .filter((action): action is (typeof switchHomeActions)[number] => Boolean(action)),
    [],
  );

  const spaceActions = useMemo(
    () => MOBILE_SPACE_ACTION_IDS
      .map((id) => switchHomeActions.find((action) => action.id === id))
      .filter((action): action is (typeof switchHomeActions)[number] => Boolean(action)),
    [],
  );

  const displayName = profile?.displayName || switchHomeUser.name;
  const displayMeta = profile?.bio || profile?.email || "MEO Blog";
  const visiblePartners = partners.filter((partner) => partner.avatarUrl && partner.name.trim());

  function resetAdminGate() {
    adminGateCodeRef.current = "";
  }

  function registerAdminGateKey(key: AdminGateKey) {
    adminGateCodeRef.current = `${adminGateCodeRef.current}${ADMIN_GATE_CODE_PARTS[key]}`.slice(
      -ADMIN_GATE_MAX_INPUTS,
    );
  }

  function closeAdminPrompt() {
    setAdminPromptOpen(false);
    setAdminAuthStatus("idle");
    setAdminAuthMessage("");
    resetAdminGate();
    if (passwordInputRef.current) passwordInputRef.current.value = "";
  }

  function openAdminPrompt() {
    setAvatarMenuOpen(false);
    setAdminPromptOpen(true);
    setAdminAuthStatus("idle");
    setAdminAuthMessage("");
    resetAdminGate();
  }

  async function openAdminArea() {
    setAvatarMenuOpen(false);

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
      // Fall through to password prompt.
    } finally {
      setSessionChecking(false);
    }

    openAdminPrompt();
  }

  async function handleAdminLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const password = passwordInputRef.current?.value.trim() ?? "";

    if (!password) {
      resetAdminGate();
      setAdminAuthStatus("error");
      setAdminAuthMessage("请输入密码");
      return;
    }

    setAdminAuthStatus("submitting");
    setAdminAuthMessage("正在验证...");

    try {
      await api.login(password, adminGateCodeRef.current);
      setAdminAuthenticated(true);
      setAdminAuthMessage("验证成功");
      window.setTimeout(() => {
        closeAdminPrompt();
        setAdminPanelOpen(true);
      }, 360);
    } catch (error) {
      resetAdminGate();
      setAdminAuthStatus("error");
      setAdminAuthMessage(error instanceof Error ? error.message : "验证失败");
    }
  }

  const openGithubProfile = useCallback(() => {
    setAvatarMenuOpen(false);
    const ghUsername = extractGithubUsername(profile?.githubUrl);
    if (ghUsername) {
      setShowGithub(true);
    } else {
      openExternal(GITHUB_HOME_URL);
    }
  }, [profile?.githubUrl]);

  const openProject = useCallback(async (project: SwitchHomeProject) => {
    if (!isRealProject(project)) return;

    const requestId = ++detailRequestRef.current;
    playSound("project-click");
    setSelectedProjectId(project.id);
    setDetailProject(project);

    if (!project.slug) {
      setDetailLoading(false);
      return;
    }

    setDetailLoading(true);
    try {
      const full = await api.getProjectDetail(project.slug);
      if (detailRequestRef.current === requestId) setDetailProject(full);
    } catch {
      // Keep the summary open.
    } finally {
      if (detailRequestRef.current === requestId) setDetailLoading(false);
    }
  }, [playSound]);

  const activateAction = useCallback((actionId: string) => {
    setAvatarMenuOpen(false);
    playSound("action-click");

    if (actionId === "github-home") {
      openGithubProfile();
      return;
    }

    if (actionId === "resume") {
      setShowResume(true);
      return;
    }

    if (actionId === "contact") {
      setShowGuestbook(true);
      return;
    }

    if (actionId === "admin") {
      void openAdminArea();
      return;
    }

    if (actionId === "power") {
      pageRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [openGithubProfile, playSound]);

  return (
    <section ref={pageRef} className="mobile-switch-app" aria-label="MEO Blog mobile home">
      <header className="mobile-topbar">
        <div className="mobile-brand-group">
          <span className="mobile-site-icon" aria-hidden="true">
            <img src="/site-icon.png" alt="" draggable="false" />
          </span>
          <div className="mobile-profile-copy">
            <strong>{displayName}</strong>
            <span>{displayMeta}</span>
          </div>
        </div>

        <div className="mobile-top-actions">
          <button
            className="mobile-icon-button"
            type="button"
            aria-label="留言"
            onClick={() => activateAction("contact")}
          >
            <Icon name="contact" />
          </button>

          <div className="mobile-avatar-shell">
            <button
              className="mobile-avatar-button"
              type="button"
              aria-label="个人菜单"
              aria-expanded={avatarMenuOpen}
              onClick={() => {
                playSound("action-click");
                setAvatarMenuOpen((open) => !open);
              }}
            >
              {profile?.avatarUrl ? (
                <img src={profile.avatarUrl} alt="" />
              ) : (
                <span>{displayName.charAt(0)}</span>
              )}
            </button>

            {avatarMenuOpen && (
              <div className="mobile-avatar-menu" role="menu">
                <button type="button" role="menuitem" onClick={openGithubProfile}>
                  GitHub
                </button>
                <button type="button" role="menuitem" onClick={() => void openAdminArea()}>
                  {sessionChecking ? "检查中..." : "管理后台"}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="mobile-app-content">
        {visiblePartners.length > 0 && (
          <section className="mobile-partner-section" aria-labelledby="mobile-partners-title">
            <div className="mobile-section-heading mobile-partner-heading">
              <h2 id="mobile-partners-title">合作伙伴</h2>
            </div>
            <div className="mobile-partner-strip" role="list">
              {visiblePartners.map((partner) => {
                const content = (
                  <>
                    <span className="mobile-partner-avatar">
                      <img src={partner.avatarUrl} alt="" draggable="false" />
                    </span>
                    <span className="mobile-partner-name">{partner.name}</span>
                  </>
                );

                return partner.websiteUrl ? (
                  <a
                    key={partner.id}
                    className="mobile-partner-item"
                    href={partner.websiteUrl}
                    target="_blank"
                    rel="noreferrer"
                    role="listitem"
                    aria-label={`打开 ${partner.name} 的网站`}
                    onClick={() => playSound("action-click")}
                  >
                    {content}
                  </a>
                ) : (
                  <div key={partner.id} className="mobile-partner-item" role="listitem">
                    {content}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <section className="mobile-section mobile-projects-section" aria-labelledby="mobile-projects-title">
          <div className="mobile-section-heading">
            <h1 id="mobile-projects-title">项目</h1>
          </div>

          {projectItems.length > 0 ? (
            <div ref={projectStripRef} className="mobile-project-strip" role="list" aria-label="项目列表">
              {projectItems.map((project) => (
                <button
                  key={project.id}
                  className={`mobile-project-square-card ${selectedProjectId === project.id ? "is-selected" : ""}`}
                  type="button"
                  style={{ "--mobile-project-accent": project.accentColor || "#3aa7ff" } as CSSProperties}
                  aria-label={project.title}
                  aria-current={selectedProjectId === project.id ? "true" : undefined}
                  onFocus={() => setSelectedProjectId(project.id)}
                  onClick={() => {
                    setSelectedProjectId(project.id);
                    void openProject(project);
                  }}
                >
                  <span className="mobile-project-square-art">
                    {project.iconUrl ? (
                      <img src={project.iconUrl} alt="" draggable="false" />
                    ) : (
                      <span>{project.coverLabel || project.title.charAt(0)}</span>
                    )}
                  </span>
                  <span className="mobile-project-square-info">
                    <strong>{project.title}</strong>
                  </span>
                </button>
              ))}
            </div>
          ) : projectsLoading ? (
            <div
              className="mobile-project-strip mobile-project-strip-skeleton"
              role="list"
              aria-label="项目加载中"
              aria-busy="true"
            >
              {Array.from({ length: MOBILE_PROJECT_SKELETON_COUNT }).map((_, index) => (
                <div key={index} className="mobile-project-square-card mobile-project-skeleton-card" role="listitem">
                  <span className="mobile-project-square-art mobile-project-skeleton-art" />
                  <span className="mobile-project-square-info">
                    <span className="mobile-project-skeleton-label" />
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="mobile-empty-state">暂无项目</div>
          )}
        </section>

        <section className="mobile-section" aria-labelledby="mobile-space-title">
          <div className="mobile-section-heading">
            <h2 id="mobile-space-title">我的空间</h2>
          </div>

          <div className="mobile-space-grid">
            {spaceActions.map((action) => (
              <button
                key={action.id}
                className="mobile-space-tile"
                type="button"
                style={{ "--mobile-action-accent": action.accentColor } as CSSProperties}
                onClick={() => activateAction(action.id)}
              >
                <span className="mobile-space-icon">
                  <Icon name={action.icon as IconName} />
                </span>
                <span className="mobile-space-copy">
                  <strong>{MOBILE_ACTION_LABELS[action.id] ?? action.label}</strong>
                  <span>{MOBILE_ACTION_SUBTITLES[action.id] ?? ""}</span>
                </span>
              </button>
            ))}
          </div>
        </section>
      </main>

      <MobileActionDock
        actions={dockActions}
        labels={MOBILE_ACTION_LABELS}
        onActivate={activateAction}
      />

      {adminPromptOpen && createPortal(
        <div className="mobile-admin-backdrop" onClick={closeAdminPrompt}>
          <form className="mobile-admin-card" onSubmit={handleAdminLogin} onClick={(event) => event.stopPropagation()}>
            <div className="mobile-admin-header">
              <strong>Admin</strong>
              <button type="button" aria-label="关闭" onClick={closeAdminPrompt}>
                ×
              </button>
            </div>

            <label className="mobile-admin-field">
              <span>Password</span>
              <input
                ref={passwordInputRef}
                type="password"
                autoFocus
                autoComplete="current-password"
                disabled={adminAuthStatus === "submitting"}
              />
            </label>

            <div className="mobile-admin-pad" aria-label="Admin sequence">
              <div className="mobile-admin-dpad">
                <button type="button" aria-label="up" onClick={() => registerAdminGateKey("up")} />
                <button type="button" aria-label="left" onClick={() => registerAdminGateKey("left")} />
                <button type="button" aria-label="right" onClick={() => registerAdminGateKey("right")} />
                <button type="button" aria-label="down" onClick={() => registerAdminGateKey("down")} />
              </div>
              <div className="mobile-admin-face-buttons">
                {(["x", "y", "a", "b"] as const).map((key) => (
                  <button key={key} type="button" onClick={() => registerAdminGateKey(key)}>
                    {key.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {adminAuthStatus !== "idle" && (
              <p className={`mobile-admin-message ${adminAuthStatus === "error" ? "is-error" : ""}`}>
                {adminAuthMessage}
              </p>
            )}

            <div className="mobile-admin-actions">
              <button type="button" onClick={closeAdminPrompt}>
                取消
              </button>
              <button type="submit" disabled={adminAuthStatus === "submitting"}>
                验证
              </button>
            </div>
          </form>
        </div>,
        document.body,
      )}

      {adminPanelOpen && createPortal(
        <AdminPanel onClose={() => { playSound("close"); setAdminPanelOpen(false); }} />,
        document.body,
      )}

      {createPortal(<SaveToast />, document.body)}

      {detailProject && createPortal(
        <ProjectDetail
          project={detailProject}
          loading={detailLoading}
          onClose={() => {
            playSound("close");
            setDetailProject(null);
            setDetailLoading(false);
          }}
        />,
        document.body,
      )}

      {showGithub && (() => {
        const ghUsername = extractGithubUsername(profile?.githubUrl);
        return ghUsername ? createPortal(
          <GitHubProfile username={ghUsername} onClose={() => { playSound("close"); setShowGithub(false); }} />,
          document.body,
        ) : null;
      })()}

      {showGuestbook && createPortal(
        <MessageWallModal onClose={() => { playSound("close"); setShowGuestbook(false); }} />,
        document.body,
      )}

      {showResume && createPortal(
        <ResumeModal onClose={() => { playSound("close"); setShowResume(false); }} />,
        document.body,
      )}

    </section>
  );
}
