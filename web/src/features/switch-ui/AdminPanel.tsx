import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { api } from "../../api/client";
import { saveQueue } from "../../api/saveQueue";
import type { AdminProfile, Partner, Project, ProjectCreate, ProjectSummary, ProjectUpdate, SitePermissions } from "../../api/types";
import { useAdminStore } from "../../stores/adminStore";
import { DEFAULT_SITE_PERMISSIONS } from "./entryPermissions";
import { BlogCommentModeration } from "./BlogCommentModeration";
import { useWheelScroll } from "./useWheelScroll";

interface AdminPanelProps {
  onClose: () => void;
}

const ACCENT_COLORS = [
  "#24c9f4", "#6c72ff", "#ff5c88", "#2fcf7f",
  "#f0782d", "#f4b740", "#a9abb8", "#35d39a",
];
const MAX_PROJECTS = 100;
const MAX_PROJECT_MARKDOWN_SIZE = 2 * 1024 * 1024;

export function AdminPanel({ onClose }: AdminPanelProps) {
  const [tab, setTab] = useState<"profile" | "projects" | "partners" | "comments" | "permissions">("profile");
  const { setProfile, setProjectSummaries, setPartners, logout } = useAdminStore();
  const scrollRef = useWheelScroll<HTMLDivElement>();
  const [pendingBlogComments, setPendingBlogComments] = useState(0);

  useEffect(() => {
    api.getBlogCommentModeration()
      .then((queue) => setPendingBlogComments(queue.stats.pending))
      .catch(() => {});
  }, []);

  async function handleLogout() {
    try {
      await api.logout();
    } catch {
      // Ignore errors, clear local state anyway
    }
    logout();
    onClose();
  }

  return (
    <aside
      className="switch-admin-panel"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="admin-panel-window">
        <div className="switch-terminal-bar">
          <span />
          <span />
          <span />
          <strong>admin-panel.exe</strong>
          <button type="button" className="admin-logout-btn" onClick={handleLogout}>
            退出登录
          </button>
          <button type="button" aria-label="关闭" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="admin-panel-tabs">
          <button
            className={tab === "profile" ? "active" : ""}
            onClick={() => setTab("profile")}
          >
            个人信息
          </button>
          <button
            className={tab === "projects" ? "active" : ""}
            onClick={() => setTab("projects")}
          >
            项目管理
          </button>
          <button
            className={tab === "partners" ? "active" : ""}
            onClick={() => setTab("partners")}
          >
            合作伙伴
          </button>
          <button
            className={tab === "comments" ? "active" : ""}
            onClick={() => setTab("comments")}
          >
            评论审核
            {pendingBlogComments > 0 && <span className="admin-tab-badge">{pendingBlogComments}</span>}
          </button>
          <button
            className={tab === "permissions" ? "active" : ""}
            onClick={() => setTab("permissions")}
          >
            权限面板
          </button>
        </div>
        <div ref={scrollRef} className="admin-panel-body">
          {tab === "profile" && (
            <ProfileEditor onSave={(p) => setProfile(p)} />
          )}
          {tab === "projects" && (
            <ProjectManager onSave={(p) => setProjectSummaries(p)} />
          )}
          {tab === "partners" && (
            <PartnerManager onSave={(p) => setPartners(p)} />
          )}
          {tab === "comments" && (
            <BlogCommentModeration onPendingChange={setPendingBlogComments} />
          )}
          {tab === "permissions" && (
            <PermissionManager />
          )}
        </div>
      </div>
    </aside>
  );
}

const PERMISSION_ITEMS: Array<{ key: keyof SitePermissions; title: string; description: string }> = [
  { key: "github", title: "GitHub 入口", description: "允许游客打开 GitHub 资料与贡献信息" },
  { key: "resume", title: "简历入口", description: "允许游客查看已上传的个人简历" },
  { key: "guestbook", title: "留言入口", description: "允许游客浏览、发布与回复留言" },
  { key: "blog", title: "博客入口", description: "允许游客阅读博客文章与评论" },
  { key: "favorites", title: "收藏栏入口", description: "允许游客查看重要收藏栏" },
];

function PermissionManager() {
  const [permissions, setPermissions] = useState<SitePermissions>(DEFAULT_SITE_PERMISSIONS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState<"success" | "error">("success");

  useEffect(() => {
    api.getPermissions()
      .then((p) => setPermissions(p))
      .catch(() => {
        setMsg("权限配置加载失败");
        setMsgType("error");
      })
      .finally(() => setLoading(false));
  }, []);

  function showMessage(text: string, type: "success" | "error" = "success") {
    setMsg(text);
    setMsgType(type);
    window.setTimeout(() => setMsg(""), 2200);
  }

  function togglePermission(key: keyof SitePermissions) {
    setPermissions((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await api.updatePermissions(permissions);
      setPermissions(updated);
      window.dispatchEvent(new CustomEvent("site-permissions-updated", { detail: updated }));
      showMessage("权限已保存");
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "保存失败", "error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p>加载中...</p>;

  return (
    <div className="admin-permission-panel">
      <div className="admin-project-list-header">
        <strong>游客入口权限</strong>
        <button type="button" onClick={handleSave} disabled={saving}>
          {saving ? "保存中..." : "保存权限"}
        </button>
      </div>
      <div className="admin-permission-list">
        {PERMISSION_ITEMS.map((item) => {
          const enabled = permissions[item.key];
          return (
            <button
              key={item.key}
              type="button"
              className={`admin-permission-row${enabled ? " is-enabled" : ""}`}
              onClick={() => togglePermission(item.key)}
              aria-pressed={enabled}
            >
              <span className="admin-permission-copy">
                <strong>{item.title}</strong>
                <span>{item.description}</span>
              </span>
              <span className="admin-permission-switch" aria-hidden="true">
                <span />
              </span>
            </button>
          );
        })}
      </div>
      {msg && <span className={`admin-panel-msg ${msgType === "error" ? "admin-panel-msg-error" : ""}`}>{msg}</span>}
    </div>
  );
}

function ProfileEditor({ onSave }: { onSave: (p: AdminProfile) => void }) {
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState<"success" | "error">("success");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Force fresh session check (bypass 2-min cache) to avoid 401 on profile fetch
    api.checkSessionFresh().then((s) => {
      if (s.authenticated) return api.getProfile();
      return null;
    }).then((p) => { if (p) setProfile(p); }).catch(() => {});
  }, []);

  async function handleAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    try {
      const { url } = await api.uploadAvatar(file);
      const updated = { ...profile, avatarUrl: url };
      setProfile(updated);
      onSave(updated);
    } catch {
      setMsg("头像上传失败");
      setMsgType("error");
      setTimeout(() => setMsg(""), 2000);
    }
  }

  function addExtraEmail() {
    if (!profile) return;
    setProfile({ ...profile, extraEmails: [...profile.extraEmails, ""] });
  }

  function updateExtraEmail(index: number, value: string) {
    if (!profile) return;
    const emails = [...profile.extraEmails];
    emails[index] = value;
    setProfile({ ...profile, extraEmails: emails });
  }

  function removeExtraEmail(index: number) {
    if (!profile) return;
    const emails = profile.extraEmails.filter((_, i) => i !== index);
    setProfile({ ...profile, extraEmails: emails });
  }

  async function handleSave(ev: FormEvent) {
    ev.preventDefault();
    if (!profile) return;
    setSaving(true);
    try {
      const updated = await api.updateProfile({
        displayName: profile.displayName,
        email: profile.email,
        bio: profile.bio,
        phone: profile.phone,
        province: profile.province,
        city: profile.city,
        extraEmails: profile.extraEmails.filter((e) => e.trim() !== ""),
        githubUrl: profile.githubUrl,
      });
      setProfile(updated);
      onSave(updated);
      setMsg("已保存");
      setMsgType("success");
      setTimeout(() => setMsg(""), 2000);
    } catch {
      setMsg("保存失败");
      setMsgType("error");
      setTimeout(() => setMsg(""), 2000);
    }
    setSaving(false);
  }

  if (!profile) return <p>加载中...</p>;

  return (
    <form className="admin-profile-form" onSubmit={handleSave}>
      <div className="admin-profile-header">
        <div
          className="admin-avatar-upload"
          onClick={() => fileRef.current?.click()}
        >
          {profile.avatarUrl ? (
            <img src={profile.avatarUrl} alt="avatar" />
          ) : (
            <span>+</span>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={handleAvatar}
        />
        <div className="admin-profile-meta">
          <label>
            <span>昵称</span>
            <input
              value={profile.displayName}
              onChange={(e) =>
                setProfile({ ...profile, displayName: e.target.value })
              }
            />
          </label>
          <label>
            <span>主邮箱</span>
            <input
              type="email"
              value={profile.email}
              onChange={(e) =>
                setProfile({ ...profile, email: e.target.value })
              }
            />
          </label>
        </div>
      </div>
      <div className="admin-form-row">
        <label>
          <span>手机号</span>
          <input
            type="tel"
            value={profile.phone}
            placeholder="如：13800138000"
            onChange={(e) =>
              setProfile({ ...profile, phone: e.target.value })
            }
          />
        </label>
        <label>
          <span>常驻省份</span>
          <input
            value={profile.province}
            placeholder="如：广东"
            onChange={(e) =>
              setProfile({ ...profile, province: e.target.value })
            }
          />
        </label>
        <label>
          <span>常驻城市</span>
          <input
            value={profile.city}
            placeholder="如：深圳"
            onChange={(e) =>
              setProfile({ ...profile, city: e.target.value })
            }
          />
        </label>
      </div>
      <div className="admin-extra-emails">
        <div className="admin-extra-emails-header">
          <span>其他联系邮箱</span>
          <button type="button" onClick={addExtraEmail}>+ 添加</button>
        </div>
        {profile.extraEmails.length === 0 && (
          <p className="admin-extra-emails-empty">暂无其他邮箱</p>
        )}
        {profile.extraEmails.map((email, i) => (
          <div key={i} className="admin-extra-email-row">
            <input
              type="email"
              value={email}
              placeholder="输入邮箱地址"
              onChange={(e) => updateExtraEmail(i, e.target.value)}
            />
            <button type="button" onClick={() => removeExtraEmail(i)}>×</button>
          </div>
        ))}
      </div>
      <label>
        <span>GitHub 主页</span>
        <input
          type="url"
          value={profile.githubUrl}
          placeholder="https://github.com/username"
          onChange={(e) =>
            setProfile({ ...profile, githubUrl: e.target.value })
          }
        />
      </label>
      <label>
        <span>个人简介</span>
        <textarea
          className="admin-bio-textarea"
          rows={4}
          value={profile.bio}
          onChange={(e) =>
            setProfile({ ...profile, bio: e.target.value })
          }
        />
      </label>
      <div className="admin-panel-actions">
        {msg && <span className={`admin-panel-msg ${msgType === "error" ? "admin-panel-msg-error" : ""}`}>{msg}</span>}
        <button type="submit" disabled={saving}>
          {saving ? "保存中..." : "保存"}
        </button>
      </div>
    </form>
  );
}

function ProjectManager({ onSave }: { onSave: (p: ProjectSummary[]) => void }) {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [editing, setEditing] = useState<Project | null>(null);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  // Load summaries — cache sync in store avoids empty flash,
  // this call returns cached data and fires background refresh only if needed
  useEffect(() => {
    api.getProjectSummaries().then((p) => {
      setProjects(p);
      onSave(p);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  async function handleDelete(id: string) {
    if (!confirm("确定删除此项目？")) return;
    try {
      await api.deleteProject(id);
      const updated = projects.filter((p) => p.id !== id);
      setProjects(updated);
      onSave(updated);
    } catch {
      alert("删除失败，请重试");
    }
  }

  function handleEdit(p: ProjectSummary) {
    // Immediately show form with summary data (instant feedback)
    setEditing({
      id: p.id,
      name: p.name,
      slug: p.slug,
      iconUrl: p.iconUrl,
      accentColor: p.accentColor,
      category: p.category,
      status: p.status,
      pinned: p.pinned,
      sortOrder: p.sortOrder,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      coverUrl: "",
      description: "",
      repoUrl: "",
      demoUrl: "",
      techStack: [],
    } as Project);
    // Full detail loaded inside ProjectForm
  }

  function handleSaved(project: Project) {
    // Optimistic update: immediately reflect in local state
    const optimisticSummary: ProjectSummary = {
      id: project.id,
      name: project.name,
      slug: project.slug,
      coverUrl: project.coverUrl ?? "",
      iconUrl: project.iconUrl ?? "",
      accentColor: project.accentColor ?? "",
      category: project.category ?? "",
      status: project.status ?? "",
      pinned: project.pinned ?? false,
      sortOrder: project.sortOrder ?? 0,
      createdAt: project.createdAt ?? "",
      updatedAt: project.updatedAt ?? new Date().toISOString(),
    };
    const exists = projects.some((p) => p.id === project.id);
    const updated = exists
      ? projects.map((p) => (p.id === project.id ? optimisticSummary : p))
      : [...projects, optimisticSummary];
    setProjects(updated);
    onSave(updated);
    setEditing(null);
    setCreating(false);
    // Background: re-fetch real data after save completes
    setTimeout(() => {
      api.getProjectSummaries().then((p) => {
        setProjects(p);
        onSave(p);
      }).catch(() => {});
    }, 1500);
  }

  const handleDragStart = useCallback((idx: number) => {
    setDragIdx(idx);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setOverIdx(idx);
  }, []);

  const handleDrop = useCallback(async (dropIdx: number) => {
    if (dragIdx === null || dragIdx === dropIdx) {
      setDragIdx(null);
      setOverIdx(null);
      return;
    }
    const reordered = [...projects];
    const [moved] = reordered.splice(dragIdx, 1);
    reordered.splice(dropIdx, 0, moved);
    setProjects(reordered);
    onSave(reordered);
    setDragIdx(null);
    setOverIdx(null);

    try {
      await api.reorderProjects(reordered.map((p) => p.id));
    } catch {
      // ignore — order stays in local state
    }
  }, [dragIdx, projects, onSave]);

  const handleDragEnd = useCallback(() => {
    setDragIdx(null);
    setOverIdx(null);
  }, []);

  if (loading) return <p>加载中...</p>;

  if (creating || editing) {
    return (
      <ProjectForm
        project={editing}
        onCancel={() => {
          setEditing(null);
          setCreating(false);
        }}
        onSaved={handleSaved}
        onSaveError={(id) => {
          const updated = projects.filter((p) => p.id !== id);
          setProjects(updated);
          onSave(updated);
        }}
      />
    );
  }

  return (
    <div className="admin-project-list">
      <div className="admin-project-list-header">
        <strong>项目列表 ({projects.length} / {MAX_PROJECTS})</strong>
        <button
          type="button"
          onClick={() => setCreating(true)}
          disabled={projects.length >= MAX_PROJECTS}
          title={projects.length >= MAX_PROJECTS ? "最多只能创建 100 个项目" : undefined}
        >
          {projects.length >= MAX_PROJECTS ? "已达到项目上限" : "+ 新增项目"}
        </button>
      </div>
      {projects.length === 0 && (
        <p className="admin-project-empty">暂无项目，点击上方按钮新增</p>
      )}
      {projects.map((p, idx) => (
        <div
          key={p.id}
          className={`admin-project-row${dragIdx === idx ? " is-dragging" : ""}${overIdx === idx && dragIdx !== idx ? " is-over" : ""}`}
          draggable
          onDragStart={() => handleDragStart(idx)}
          onDragOver={(e) => handleDragOver(e, idx)}
          onDrop={() => handleDrop(idx)}
          onDragEnd={handleDragEnd}
        >
          <div className="admin-project-drag-handle">⠿</div>
          <div
            className="admin-project-icon"
            style={{ background: p.accentColor || "#24c9f4" }}
          >
            {p.iconUrl ? (
              <img src={p.iconUrl} alt="" />
            ) : (
              <span>{p.name.charAt(0)}</span>
            )}
          </div>
          <div className="admin-project-info">
            <strong>{p.name}</strong>
            <span>{p.category}</span>
          </div>
          <div className="admin-project-actions">
            <button type="button" onClick={() => handleEdit(p)}>
              编辑
            </button>
            <button
              type="button"
              className="danger"
              onClick={() => handleDelete(p.id)}
            >
              删除
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function PartnerManager({ onSave }: { onSave: (p: Partner[]) => void }) {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftWebsite, setDraftWebsite] = useState("");
  const [draftAvatarFile, setDraftAvatarFile] = useState<File | null>(null);
  const [draftAvatarPreview, setDraftAvatarPreview] = useState("");
  const [editing, setEditing] = useState<Record<string, { name: string; websiteUrl: string }>>({});
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState<"success" | "error">("success");
  const createFileRef = useRef<HTMLInputElement>(null);
  const rowFileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    api.getPartners().then((p) => {
      setPartners(p);
      onSave(p);
      const nextEditing: Record<string, { name: string; websiteUrl: string }> = {};
      p.forEach((partner) => {
        nextEditing[partner.id] = { name: partner.name, websiteUrl: partner.websiteUrl };
      });
      setEditing(nextEditing);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => () => {
    if (draftAvatarPreview) URL.revokeObjectURL(draftAvatarPreview);
  }, [draftAvatarPreview]);

  function showMessage(text: string, type: "success" | "error" = "success") {
    setMsg(text);
    setMsgType(type);
    window.setTimeout(() => setMsg(""), 2200);
  }

  function syncPartners(next: Partner[]) {
    setPartners(next);
    onSave(next);
  }

  function updateEditing(id: string, patch: Partial<{ name: string; websiteUrl: string }>) {
    const empty = { name: "", websiteUrl: "" };
    setEditing((prev) => ({
      ...prev,
      [id]: { ...empty, ...prev[id], ...patch },
    }));
  }

  function handleDraftAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (draftAvatarPreview) URL.revokeObjectURL(draftAvatarPreview);
    const preview = URL.createObjectURL(file);
    setDraftAvatarFile(file);
    setDraftAvatarPreview(preview);
  }

  async function handleCreate(ev: FormEvent) {
    ev.preventDefault();
    const name = draftName.trim();
    if (!name) {
      showMessage("请填写伙伴昵称", "error");
      return;
    }
    if (!draftAvatarFile) {
      showMessage("请上传伙伴头像", "error");
      return;
    }

    setCreating(true);
    try {
      const partner = await api.createPartner(draftAvatarFile, name, draftWebsite.trim());
      const next = [...partners, partner];
      syncPartners(next);
      setEditing((prev) => ({
        ...prev,
        [partner.id]: { name: partner.name, websiteUrl: partner.websiteUrl },
      }));
      setDraftName("");
      setDraftWebsite("");
      setDraftAvatarFile(null);
      if (draftAvatarPreview) URL.revokeObjectURL(draftAvatarPreview);
      setDraftAvatarPreview("");
      if (createFileRef.current) createFileRef.current.value = "";
      showMessage("伙伴已添加");
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "添加失败", "error");
    } finally {
      setCreating(false);
    }
  }

  async function handleSave(partner: Partner) {
    const form = editing[partner.id] ?? { name: partner.name, websiteUrl: partner.websiteUrl };
    const name = form.name.trim();
    if (!name) {
      showMessage("昵称不能为空", "error");
      return;
    }

    setSavingId(partner.id);
    try {
      const updated = await api.updatePartner(partner.id, {
        name,
        websiteUrl: form.websiteUrl.trim(),
      });
      const next = partners.map((p) => (p.id === partner.id ? updated : p));
      syncPartners(next);
      updateEditing(partner.id, { name: updated.name, websiteUrl: updated.websiteUrl });
      showMessage("伙伴已保存");
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "保存失败", "error");
    } finally {
      setSavingId(null);
    }
  }

  async function handleAvatar(id: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSavingId(id);
    try {
      const { url } = await api.uploadPartnerAvatar(id, file);
      const next = partners.map((p) => (p.id === id ? { ...p, avatarUrl: url } : p));
      syncPartners(next);
      showMessage("头像已更新");
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "头像上传失败", "error");
    } finally {
      setSavingId(null);
      if (rowFileRefs.current[id]) rowFileRefs.current[id]!.value = "";
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("确定删除这个合作伙伴吗？")) return;
    setSavingId(id);
    try {
      await api.deletePartner(id);
      const next = partners.filter((p) => p.id !== id);
      syncPartners(next);
      setEditing((prev) => {
        const clone = { ...prev };
        delete clone[id];
        return clone;
      });
      showMessage("伙伴已删除");
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "删除失败", "error");
    } finally {
      setSavingId(null);
    }
  }

  if (loading) return <p>加载中...</p>;

  return (
    <div className="admin-partner-manager">
      <form className="admin-partner-create" onSubmit={handleCreate}>
        <button
          type="button"
          className="admin-partner-avatar-upload"
          onClick={() => createFileRef.current?.click()}
          aria-label="上传合作伙伴头像"
        >
          {draftAvatarPreview ? <img src={draftAvatarPreview} alt="" /> : <span>+</span>}
        </button>
        <input
          ref={createFileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={handleDraftAvatar}
        />
        <label>
          <span>昵称</span>
          <input
            value={draftName}
            placeholder="例如：xiaoli"
            onChange={(e) => setDraftName(e.target.value)}
            required
          />
        </label>
        <label>
          <span>个人博客网站</span>
          <input
            type="text"
            inputMode="url"
            value={draftWebsite}
            placeholder="https://example.com"
            onChange={(e) => setDraftWebsite(e.target.value)}
          />
        </label>
        <button type="submit" disabled={creating}>
          {creating ? "添加中..." : "+ 添加"}
        </button>
      </form>

      <div className="admin-partner-list">
        <div className="admin-project-list-header">
          <strong>合作伙伴 ({partners.length})</strong>
        </div>
        {partners.length === 0 && (
          <p className="admin-project-empty">暂无合作伙伴，先上传一个头像吧。</p>
        )}
        {partners.map((partner) => {
          const form = editing[partner.id] ?? { name: partner.name, websiteUrl: partner.websiteUrl };
          const isSaving = savingId === partner.id;
          return (
            <div key={partner.id} className="admin-partner-row">
              <button
                type="button"
                className="admin-partner-avatar"
                onClick={() => rowFileRefs.current[partner.id]?.click()}
                aria-label={`更换 ${partner.name} 的头像`}
                disabled={isSaving}
              >
                <img src={partner.avatarUrl} alt="" />
              </button>
              <input
                ref={(node) => { rowFileRefs.current[partner.id] = node; }}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => handleAvatar(partner.id, e)}
              />
              <label>
                <span>昵称</span>
                <input
                  value={form.name}
                  onChange={(e) => updateEditing(partner.id, { name: e.target.value })}
                />
              </label>
              <label>
                <span>网站</span>
                <input
                  type="text"
                  inputMode="url"
                  value={form.websiteUrl}
                  placeholder="https://example.com"
                  onChange={(e) => updateEditing(partner.id, { websiteUrl: e.target.value })}
                />
              </label>
              <div className="admin-project-actions">
                <button type="button" onClick={() => handleSave(partner)} disabled={isSaving}>
                  保存
                </button>
                <button
                  type="button"
                  className="danger"
                  onClick={() => handleDelete(partner.id)}
                  disabled={isSaving}
                >
                  删除
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {msg && <span className={`admin-panel-msg ${msgType === "error" ? "admin-panel-msg-error" : ""}`}>{msg}</span>}
    </div>
  );
}

function ProjectForm({
  project,
  onCancel,
  onSaved,
  onSaveError,
}: {
  project: Project | null;
  onCancel: () => void;
  onSaved: (p: Project) => void;
  onSaveError?: (id: string) => void;
}) {
  const originalRef = useRef<ProjectCreate | null>(null);
  const [form, setForm] = useState<ProjectCreate>(() => {
    const initial = {
      name: project?.name ?? "",
      slug: project?.slug ?? "",
      description: project?.description ?? "",
      repoUrl: project?.repoUrl ?? "",
      iconUrl: project?.iconUrl ?? "",
      accentColor: project?.accentColor ?? "#24c9f4",
      category: project?.category ?? "",
      status: project?.status ?? "ready",
      techStack: project?.techStack ?? [],
    };
    // Only snapshot original if we already have full data (not a summary stub)
    if (project?.description) originalRef.current = initial;
    return initial;
  });
  const [saving, setSaving] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [pendingIconFile, setPendingIconFile] = useState<File | null>(null);
  const [descriptionFileName, setDescriptionFileName] = useState(
    project?.description ? `${project.slug || "project"}-intro.md` : "",
  );
  const [descriptionFileError, setDescriptionFileError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const descriptionFileRef = useRef<HTMLInputElement>(null);
  const pendingIconUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (pendingIconUrlRef.current) URL.revokeObjectURL(pendingIconUrlRef.current);
    };
  }, []);

  // Load full detail when editing an existing project (form shows summary first)
  useEffect(() => {
    if (!project?.slug || project.description) return; // already has full data
    setDetailLoading(true);
    api.getProjectDetail(project.slug).then((full) => {
      const fullForm: ProjectCreate = {
        name: full.name,
        slug: full.slug,
        description: full.description ?? "",
        repoUrl: full.repoUrl ?? "",
        iconUrl: full.iconUrl ?? "",
        accentColor: full.accentColor ?? "#24c9f4",
        category: full.category ?? "",
        status: full.status ?? "ready",
        techStack: full.techStack ?? [],
      };
      setForm(fullForm);
      if (fullForm.description) {
        setDescriptionFileName(`${full.slug || "project"}-intro.md`);
      }
      originalRef.current = fullForm;
    }).catch(() => {}).finally(() => setDetailLoading(false));
  }, [project?.slug]);

  function autoSlug(name: string) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9一-鿿]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  async function handleIcon(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (project) {
      const { url } = await api.uploadProjectIcon(project.id, file);
      setForm((f) => ({ ...f, iconUrl: url }));
    } else {
      if (pendingIconUrlRef.current) URL.revokeObjectURL(pendingIconUrlRef.current);
      const previewUrl = URL.createObjectURL(file);
      pendingIconUrlRef.current = previewUrl;
      setPendingIconFile(file);
      setForm((f) => ({ ...f, iconUrl: previewUrl }));
    }
  }

  async function handleDescriptionFile(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;

    if (!/\.(md|markdown)$/i.test(file.name)) {
      setDescriptionFileError("请选择 .md 或 .markdown 文档");
      return;
    }
    if (file.size > MAX_PROJECT_MARKDOWN_SIZE) {
      setDescriptionFileError("Markdown 文档不能超过 2 MB");
      return;
    }

    try {
      const description = (await file.text()).replace(/^\uFEFF/, "");
      if (!description.trim()) {
        setDescriptionFileError("Markdown 文档内容不能为空");
        return;
      }
      setForm((current) => ({ ...current, description }));
      setDescriptionFileName(file.name);
      setDescriptionFileError("");
    } catch {
      setDescriptionFileError("文档读取失败，请重新选择");
    }
  }

  async function handleSubmit(ev: FormEvent) {
    ev.preventDefault();
    if (!form.name) return;
    setSaving(true);

    const optimisticIconUrl = form.iconUrl.startsWith("blob:") ? "" : form.iconUrl;
    const optimisticProject: Project = project
      ? { ...project, ...form, updatedAt: new Date().toISOString() }
      : {
          id: crypto.randomUUID(),
          ...form,
          iconUrl: optimisticIconUrl,
          coverUrl: "",
          demoUrl: "",
          pinned: false,
          sortOrder: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

    if (project) {
      const patch: ProjectUpdate = {};
      const orig = originalRef.current;
      if (orig) {
        (Object.keys(form) as (keyof ProjectCreate)[]).forEach((k) => {
          const cur = form[k];
          const old = orig[k];
          if (Array.isArray(cur) && Array.isArray(old)) {
            if (JSON.stringify(cur) !== JSON.stringify(old)) (patch as Record<string, unknown>)[k] = cur;
          } else if (cur !== old) {
            (patch as Record<string, unknown>)[k] = cur;
          }
        });
      } else {
        Object.assign(patch, form);
      }
      if (!patch.name) patch.name = form.name;
      if (!patch.slug) patch.slug = form.slug;
      saveQueue.enqueue({
        id: project.id,
        label: "保存项目",
        execute: () => api.updateProject(project.id, patch),
      });
    } else {
      const createPayload = pendingIconFile ? { ...form, iconUrl: "" } : form;
      saveQueue.enqueue({
        id: optimisticProject.id,
        label: "创建项目",
        execute: async () => {
          const created = await api.createProject(createPayload);
          if (pendingIconFile) {
            await api.uploadProjectIcon(created.id, pendingIconFile);
          }
        },
        onError: () => onSaveError?.(optimisticProject.id),
      });
    }

    setSaving(false);
    onSaved(optimisticProject);
  }

  return (
    <form className="admin-project-form" onSubmit={handleSubmit}>
      <strong>{project ? "编辑项目" : "新增项目"}</strong>
      <div className="admin-form-row">
        <label>
          <span>项目名称</span>
          <input
            value={form.name}
            onChange={(e) => {
              const name = e.target.value;
              setForm((f) => ({
                ...f,
                name,
                slug: project ? f.slug : autoSlug(name),
              }));
            }}
            required
          />
        </label>
        <label>
          <span>Slug</span>
          <input
            value={form.slug}
            onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
            required
          />
        </label>
      </div>
      <div className="admin-project-markdown-field">
        <span className="admin-project-markdown-label">项目简介（上传 Markdown 文档）</span>
        {detailLoading ? (
          <div className="admin-detail-skeleton">
            <div className="admin-skeleton-line" />
            <div className="admin-skeleton-line short" />
            <div className="admin-skeleton-line" />
          </div>
        ) : (
          <>
            <input
              ref={descriptionFileRef}
              type="file"
              accept=".md,.markdown,text/markdown"
              hidden
              onChange={handleDescriptionFile}
            />
            <button
              type="button"
              className={`admin-markdown-upload${descriptionFileError ? " has-error" : ""}`}
              onClick={() => descriptionFileRef.current?.click()}
            >
              <span className="admin-markdown-upload-icon">MD</span>
              <span className="admin-markdown-upload-copy">
                <strong>{descriptionFileName || "选择 Markdown 文档"}</strong>
                <span>
                  {form.description
                    ? `已读取 ${form.description.length.toLocaleString()} 个字符，点击可替换`
                    : "点击上传 .md 或 .markdown 文件，最大 2 MB"}
                </span>
              </span>
              <span className="admin-markdown-upload-action">
                {form.description ? "重新上传" : "选择文件"}
              </span>
            </button>
            {descriptionFileError && (
              <span className="admin-markdown-upload-error">{descriptionFileError}</span>
            )}
          </>
        )}
      </div>
      <div className="admin-form-row">
        <label>
          <span>GitHub 链接</span>
          <input
            value={form.repoUrl}
            placeholder="https://github.com/..."
            onChange={(e) =>
              setForm((f) => ({ ...f, repoUrl: e.target.value }))
            }
          />
        </label>
        <label>
          <span>分类</span>
          <input
            value={form.category}
            placeholder="如：Web, CLI, App"
            onChange={(e) =>
              setForm((f) => ({ ...f, category: e.target.value }))
            }
          />
        </label>
      </div>
      <div className="admin-form-row">
        <label>
          <span>图标</span>
          <div className="admin-icon-upload" onClick={() => fileRef.current?.click()}>
            {form.iconUrl ? (
              <img src={form.iconUrl} alt="" />
            ) : (
              <span>点击上传</span>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={handleIcon}
          />
        </label>
        <label>
          <span>主题色</span>
          <div className="admin-color-picker">
            {ACCENT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={form.accentColor === c ? "active" : ""}
                style={{ background: c }}
                onClick={() => setForm((f) => ({ ...f, accentColor: c }))}
              />
            ))}
          </div>
        </label>
        <label>
          <span>状态</span>
          <select
            value={form.status}
            onChange={(e) =>
              setForm((f) => ({ ...f, status: e.target.value }))
            }
          >
            <option value="ready">已上线</option>
            <option value="soon">即将推出</option>
          </select>
        </label>
      </div>
      <div className="admin-tech-stack-section">
        <div className="admin-tech-stack-header">
          <span>技术栈</span>
          <button type="button" onClick={() => setShowPicker(true)}>+ 添加</button>
        </div>
        {detailLoading ? (
          <p className="admin-tech-stack-empty">加载中...</p>
        ) : form.techStack.length > 0 ? (
          <div className="admin-tech-stack-chips">
            {form.techStack.map((t) => (
              <span key={t} className="admin-tech-stack-chip">
                <img
                  src={`/icons/tech-stack/${t}/${t}-original.svg`}
                  alt={t}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
                <span>{t}</span>
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, techStack: f.techStack.filter((s) => s !== t) }))}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        ) : (
          <p className="admin-tech-stack-empty">暂未选择技术栈</p>
        )}
      </div>
      {showPicker && (
        <TechStackPicker
          selected={form.techStack}
          onConfirm={(stack) => {
            setForm((f) => ({ ...f, techStack: stack }));
            setShowPicker(false);
          }}
          onClose={() => setShowPicker(false)}
        />
      )}
      <div className="admin-panel-actions">
        <button type="button" onClick={onCancel}>
          取消
        </button>
        <button type="submit" disabled={saving}>
          {saving ? "保存中..." : "保存"}
        </button>
      </div>
    </form>
  );
}

interface DeviconEntry {
  name: string;
  altnames: string[];
  tags: string[];
  versions: { svg: string[]; font: string[] };
  color: string;
}

function TechStackPicker({
  selected,
  onConfirm,
  onClose,
}: {
  selected: string[];
  onConfirm: (stack: string[]) => void;
  onClose: () => void;
}) {
  const [icons, setIcons] = useState<DeviconEntry[]>([]);
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set(selected));
  const scrollRef = useWheelScroll<HTMLDivElement>();
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const CACHE_KEY = "tech-stack-icons-v1";
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        setIcons(JSON.parse(cached));
        searchRef.current?.focus();
        return;
      }
    } catch { /* ignore */ }
    fetch("/icons/tech-stack/devicon.json")
      .then((r) => r.json())
      .then((data: DeviconEntry[]) => {
        const withOriginal = data.filter((d) => d.versions.svg.includes("original"));
        setIcons(withOriginal);
        try { localStorage.setItem(CACHE_KEY, JSON.stringify(withOriginal)); } catch { /* quota */ }
      })
      .catch(() => {});
    searchRef.current?.focus();
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return icons;
    const q = search.toLowerCase();
    return icons.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        i.altnames.some((a) => a.toLowerCase().includes(q)) ||
        i.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }, [icons, search]);

  function toggle(name: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  return (
    <div className="tech-picker-backdrop" onClick={onClose}>
      <div className="tech-picker-card" onClick={(e) => e.stopPropagation()}>
        <div className="tech-picker-bar">
          <strong>选择技术栈</strong>
          <button type="button" aria-label="关闭" onClick={onClose}>
            ×
          </button>
        </div>
        <input
          ref={searchRef}
          className="tech-picker-search"
          type="text"
          placeholder="搜索技术栈..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="tech-picker-count">
          已选 {picked.size} 项 · 显示 {filtered.length} 项
        </div>
        <div ref={scrollRef} className="tech-picker-grid">
          {filtered.map((icon) => (
            <button
              key={icon.name}
              type="button"
              className={`tech-picker-item${picked.has(icon.name) ? " selected" : ""}`}
              onClick={() => toggle(icon.name)}
              title={icon.altnames.length ? `${icon.name} (${icon.altnames.join(", ")})` : icon.name}
            >
              <img
                src={`/icons/tech-stack/${icon.name}/${icon.name}-original.svg`}
                alt={icon.name}
                loading="lazy"
              />
              <span>{icon.name}</span>
            </button>
          ))}
        </div>
        <div className="tech-picker-actions">
          <button type="button" onClick={onClose}>
            取消
          </button>
          <button type="button" className="primary" onClick={() => onConfirm([...picked])}>
            确认 ({picked.size})
          </button>
        </div>
      </div>
    </div>
  );
}
