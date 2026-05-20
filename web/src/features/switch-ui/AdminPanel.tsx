import { useEffect, useRef, useState, type FormEvent } from "react";
import { api } from "../../api/client";
import type { AdminProfile, Project, ProjectCreate } from "../../api/types";
import { useAdminStore } from "../../stores/adminStore";

interface AdminPanelProps {
  onClose: () => void;
}

const ACCENT_COLORS = [
  "#24c9f4", "#6c72ff", "#ff5c88", "#2fcf7f",
  "#f0782d", "#f4b740", "#a9abb8", "#35d39a",
];

export function AdminPanel({ onClose }: AdminPanelProps) {
  const [tab, setTab] = useState<"profile" | "projects">("profile");
  const { setProfile, setProjects } = useAdminStore();
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const stopWheel = (e: WheelEvent) => {
      e.stopPropagation();
    };
    el.addEventListener("wheel", stopWheel, { capture: true });
    return () => el.removeEventListener("wheel", stopWheel, { capture: true });
  }, []);

  return (
    <aside
      ref={panelRef}
      className="switch-admin-panel"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="admin-panel-window">
        <div className="switch-terminal-bar">
          <span />
          <span />
          <span />
          <strong>admin-panel.exe</strong>
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
        </div>
        <div className="admin-panel-body">
          {tab === "profile" && (
            <ProfileEditor onSave={(p) => setProfile(p)} />
          )}
          {tab === "projects" && (
            <ProjectManager onSave={(p) => setProjects(p)} />
          )}
        </div>
      </div>
    </aside>
  );
}

function ProfileEditor({ onSave }: { onSave: (p: AdminProfile) => void }) {
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.getProfile().then(setProfile).catch(() => {});
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
      });
      setProfile(updated);
      onSave(updated);
      setMsg("已保存");
    } catch {
      setMsg("保存失败");
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
        <span>个人简介</span>
        <textarea
          rows={4}
          value={profile.bio}
          onChange={(e) =>
            setProfile({ ...profile, bio: e.target.value })
          }
        />
      </label>
      <div className="admin-panel-actions">
        {msg && <span className="admin-panel-msg">{msg}</span>}
        <button type="submit" disabled={saving}>
          {saving ? "保存中..." : "保存"}
        </button>
      </div>
    </form>
  );
}

function ProjectManager({ onSave }: { onSave: (p: Project[]) => void }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [editing, setEditing] = useState<Project | null>(null);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getProjects().then((p) => {
      setProjects(p);
      onSave(p);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  async function handleDelete(id: string) {
    if (!confirm("确定删除此项目？")) return;
    await api.deleteProject(id);
    const updated = projects.filter((p) => p.id !== id);
    setProjects(updated);
    onSave(updated);
  }

  function handleSaved(project: Project) {
    let updated: Project[];
    if (creating) {
      updated = [...projects, project];
    } else {
      updated = projects.map((p) => (p.id === project.id ? project : p));
    }
    setProjects(updated);
    onSave(updated);
    setEditing(null);
    setCreating(false);
  }

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
      />
    );
  }

  return (
    <div className="admin-project-list">
      <div className="admin-project-list-header">
        <strong>项目列表 ({projects.length})</strong>
        <button type="button" onClick={() => setCreating(true)}>
          + 新增项目
        </button>
      </div>
      {projects.length === 0 && (
        <p className="admin-project-empty">暂无项目，点击上方按钮新增</p>
      )}
      {projects.map((p) => (
        <div key={p.id} className="admin-project-row">
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
            <span>{p.description?.slice(0, 50)}</span>
          </div>
          <div className="admin-project-actions">
            <button type="button" onClick={() => setEditing(p)}>
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

function ProjectForm({
  project,
  onCancel,
  onSaved,
}: {
  project: Project | null;
  onCancel: () => void;
  onSaved: (p: Project) => void;
}) {
  const [form, setForm] = useState<ProjectCreate>({
    name: project?.name ?? "",
    slug: project?.slug ?? "",
    description: project?.description ?? "",
    repoUrl: project?.repoUrl ?? "",
    iconUrl: project?.iconUrl ?? "",
    accentColor: project?.accentColor ?? "#24c9f4",
    category: project?.category ?? "",
    status: project?.status ?? "ready",
  });
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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
      const reader = new FileReader();
      reader.onload = () =>
        setForm((f) => ({ ...f, iconUrl: reader.result as string }));
      reader.readAsDataURL(file);
    }
  }

  async function handleSubmit(ev: FormEvent) {
    ev.preventDefault();
    if (!form.name) return;
    setSaving(true);
    try {
      let saved: Project;
      if (project) {
        saved = await api.updateProject(project.id, form);
      } else {
        saved = await api.createProject(form);
      }
      onSaved(saved);
    } catch {
      alert("保存失败");
    }
    setSaving(false);
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
      <label>
        <span>项目简介</span>
        <textarea
          rows={3}
          value={form.description}
          onChange={(e) =>
            setForm((f) => ({ ...f, description: e.target.value }))
          }
        />
      </label>
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
