import { lazy, Suspense, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import remarkGfm from "remark-gfm";

const Markdown = lazy(() => import("react-markdown"));
import { api } from "../../api/client";
import { saveQueue } from "../../api/saveQueue";
import type { BlogCategory, BlogCategoryCreate, BlogPost, BlogPostCreate } from "../../api/types";
import { useAdminStore } from "../../stores/adminStore";
import { BlogComments } from "./BlogComments";
import { useWheelScroll } from "./useWheelScroll";

interface BlogBookshelfProps {
  onClose: () => void;
  initialPostId?: string;
  onOpenPost?: (post: BlogPost) => void;
  onBackToBlog?: () => void;
}

type View = "shelf" | "posts" | "reader" | "editor";

const MAX_BLOG_MARKDOWN_SIZE = 2 * 1024 * 1024;

function formatBookTitle(name: string) {
  return Array.from(name.trim()).slice(0, 10).join("");
}

function autoSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9一-鿿]+/g, "-")
    .replace(/^-|-$/g, "");
}

function stripMarkdownSyntax(value: string) {
  return value
    .replace(/!\[[^\]]*]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/[`*_~>#-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function summarizeMarkdown(content: string) {
  const blocks = content.split(/\n\s*\n/);
  for (const block of blocks) {
    const lines = block
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) =>
        line &&
        !line.startsWith("#") &&
        !line.startsWith("```") &&
        !line.startsWith("|") &&
        !line.startsWith("!")
      );
    const summary = stripMarkdownSyntax(lines.join(" "));
    if (summary) return Array.from(summary).slice(0, 140).join("");
  }
  return "";
}

function parseMarkdownFrontMatter(raw: string) {
  const content = raw.replace(/^\uFEFF/, "");
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)/);
  if (!match) return { metadata: {} as Record<string, string>, body: content };

  const metadata: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const field = line.match(/^([A-Za-z][\w-]*):\s*(.*)$/);
    if (!field) continue;
    const key = field[1].toLowerCase().replace(/[-_]/g, "");
    const value = field[2].trim().replace(/^[ '\"]|[ '\"]$/g, "");
    if (value) metadata[key] = value;
  }

  return { metadata, body: content.slice(match[0].length) };
}

function parseBlogMarkdownDocument(raw: string, fileName: string) {
  const { metadata, body } = parseMarkdownFrontMatter(raw);
  const contentMd = body.replace(/^\s+/, "");
  const fileTitle = fileName.replace(/\.(md|markdown)$/i, "");
  const firstHeading = contentMd.match(/^#\s+(.+)$/m)?.[1]?.trim();
  const title = metadata.title || firstHeading || fileTitle;
  const status = metadata.status === "published" || metadata.status === "draft"
    ? metadata.status
    : undefined;

  return {
    title,
    slug: metadata.slug || autoSlug(title || fileTitle),
    summary: metadata.summary || metadata.description || summarizeMarkdown(contentMd),
    contentMd,
    coverUrl: metadata.coverurl || metadata.cover || metadata.image || metadata.thumbnail,
    category: metadata.categoryid || metadata.category,
    status,
  };
}

function resolveImportedCategoryId(value: string | undefined, categories: BlogCategory[]) {
  if (!value) return "";
  const normalized = value.trim().toLowerCase();
  return categories.find((category) =>
    category.id.toLowerCase() === normalized ||
    category.slug.toLowerCase() === normalized ||
    category.name.toLowerCase() === normalized
  )?.id ?? "";
}

export function BlogBookshelf({ onClose, initialPostId, onOpenPost, onBackToBlog }: BlogBookshelfProps) {
  const [view, setView] = useState<View>("shelf");
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<BlogCategory | null>(null);
  const [selectedPost, setSelectedPost] = useState<BlogPost | null>(null);
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [creatingPost, setCreatingPost] = useState(false);
  const { authenticated: isAdmin } = useAdminStore();
  const scrollRef = useWheelScroll<HTMLDivElement>({ wheelMultiplier: 3.6 });

  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [postSaveSignal, setPostSaveSignal] = useState(0);

  useEffect(() => {
    if (categories.length === 0) setLoading(true);
    // Fetch categories + all posts to compute postCount client-side
    Promise.all([
      api.getBlogCategoriesFresh(),
      api.getBlogPostsFresh(),
    ]).then(([c, posts]) => {
      const countMap: Record<string, number> = {};
      for (const p of posts) {
        countMap[p.categoryId] = (countMap[p.categoryId] ?? 0) + 1;
      }
      const withCount = c.map((cat) => ({ ...cat, postCount: countMap[cat.id] ?? cat.postCount ?? 0 }));
      setCategories(withCount);
      setLoading(false);
      setError(null);
    }).catch(() => {
      setLoading(false);
      setError("加载失败，请检查网络");
    });
  }, [retryCount, postSaveSignal]);

  useEffect(() => {
    if (!initialPostId) return;

    let cancelled = false;
    setLoading(true);
    setError(null);
    api.getBlogPost(initialPostId).then((post) => {
      if (cancelled) return;
      setSelectedPost(post);
      setSelectedCategory((current) => current ?? categories.find((cat) => cat.id === post.categoryId) ?? null);
      setView("reader");
    }).catch(() => {
      if (!cancelled) setError("文章加载失败，请检查链接");
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [initialPostId, categories]);

  function handleSaveComplete() {
    setPostSaveSignal((s) => s + 1);
  }

  function handleSelectCategory(cat: BlogCategory) {
    setSelectedCategory(cat);
    setView("posts");
  }

  function handleSelectPost(post: BlogPost) {
    setSelectedPost(post);
    setView("reader");
    onOpenPost?.(post);
  }

  function handleEditPost(post: BlogPost) {
    setEditingPost(post);
    setCreatingPost(false);
    setView("editor");
  }

  function handleCreatePost() {
    setEditingPost(null);
    setCreatingPost(true);
    setView("editor");
  }

  function handleBack() {
    if (view === "editor") {
      setView("posts");
      setEditingPost(null);
      setCreatingPost(false);
    } else if (view === "reader") {
      if (initialPostId) onBackToBlog?.();
      setView(selectedCategory ? "posts" : "shelf");
      setSelectedPost(null);
    } else if (view === "posts") {
      setView("shelf");
      setSelectedCategory(null);
    }
  }

  function handlePostSaved() {
    setView("posts");
    setEditingPost(null);
    setCreatingPost(false);
  }

  function handleCategorySaved(cat: BlogCategory) {
    setCategories((prev) => [...prev, cat]);
    setCreatingCategory(false);
  }

  function handleCategoryDeleted(id: string) {
    setCategories((prev) => prev.filter((c) => c.id !== id));
  }

  return (
    <aside
      className="blog-backdrop"
      onClick={onClose}
    >
      <div className="blog-card" onClick={(e) => e.stopPropagation()}>
        <div className="blog-header-bar">
          <span className="blog-header-icon">📚</span>
          <strong>魔法书柜</strong>
          <button type="button" className="blog-close-btn" aria-label="关闭" onClick={onClose}>×</button>
        </div>
        <div ref={scrollRef} className="blog-card-body">
          {loading && (
            <div className="blog-loading">
              <div className="blog-loading-spinner" />
              <p>正在打开魔法书柜...</p>
            </div>
          )}
          {!loading && error && (
            <div className="blog-loading">
              <p>⚠️ {error}</p>
              <button
                className="switch-favorites-upload-btn"
                type="button"
                onClick={() => setRetryCount((c) => c + 1)}
              >
                重试
              </button>
            </div>
          )}
          {!loading && !error && view === "shelf" && (
            <ShelfView
              categories={categories}
              onSelect={handleSelectCategory}
              onCreateCategory={() => setCreatingCategory(true)}
              onDeleteCategory={handleCategoryDeleted}
              isAdmin={isAdmin}
              creatingCategory={creatingCategory}
              onCategorySaved={handleCategorySaved}
              onCancelCreate={() => setCreatingCategory(false)}
            />
          )}
          {view === "posts" && selectedCategory && (
            <PostsView
              category={selectedCategory}
              onSelect={handleSelectPost}
              onEdit={handleEditPost}
              onBack={handleBack}
              onCreate={handleCreatePost}
              isAdmin={isAdmin}
              refreshSignal={postSaveSignal}
            />
          )}
          {view === "reader" && selectedPost && (
            <ReaderView
              post={selectedPost}
              onBack={handleBack}
              isAdmin={isAdmin}
            />
          )}
          {view === "editor" && (creatingPost || editingPost) && (
            <PostEditor
              post={editingPost}
              categories={categories}
              defaultCategoryId={selectedCategory?.id ?? ""}
              onBack={handleBack}
              onSaved={handlePostSaved}
              onSaveComplete={handleSaveComplete}
            />
          )}
        </div>
      </div>
    </aside>
  );
}

// --- Shelf View ---

function ShelfView({
  categories,
  onSelect,
  onCreateCategory,
  onDeleteCategory,
  isAdmin,
  creatingCategory,
  onCategorySaved,
  onCancelCreate,
}: {
  categories: BlogCategory[];
  onSelect: (c: BlogCategory) => void;
  onCreateCategory: () => void;
  onDeleteCategory: (id: string) => void;
  isAdmin: boolean;
  creatingCategory: boolean;
  onCategorySaved: (c: BlogCategory) => void;
  onCancelCreate: () => void;
}) {
  return (
    <div className="blog-shelf-view">
      <div className="blog-shelf">
        {categories.map((cat, i) => (
          <div
            key={cat.id}
            className="blog-book"
            style={{
              "--book-color": cat.color,
              animationDelay: `${i * 0.08}s`,
            } as React.CSSProperties}
            onClick={() => onSelect(cat)}
          >
            <div className="blog-book-spine" />
            <div className="blog-book-cover">
              <span className="blog-book-icon">{cat.icon}</span>
              <span className="blog-book-title" title={cat.name}>{formatBookTitle(cat.name)}</span>
              <span className="blog-book-count">{cat.postCount || 0} 篇</span>
            </div>
            {isAdmin && (
              <button
                className="blog-book-delete"
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`确定删除分类"${cat.name}"？`)) {
                    api.deleteBlogCategory(cat.id).then(() => onDeleteCategory(cat.id)).catch((err: unknown) => {
                      const msg = err instanceof Error ? err.message : "未知错误";
                      if (msg.includes("session")) return;
                      alert(`删除失败：${msg}`);
                    });
                  }
                }}
              >
                ×
              </button>
            )}
          </div>
        ))}
        {categories.length === 0 && !creatingCategory && (
          <div className="blog-shelf-empty">
            <p>书柜空空如也...</p>
            {isAdmin && <p>点击下方按钮添加第一本魔法书</p>}
          </div>
        )}
      </div>
      <div className="blog-shelf-base" />
      {creatingCategory && (
        <CategoryForm onSaved={onCategorySaved} onCancel={onCancelCreate} categoryCount={categories.length} />
      )}
      {isAdmin && !creatingCategory && (
        <button className="blog-add-btn" onClick={onCreateCategory}>
          + 新增分类
        </button>
      )}
    </div>
  );
}

// --- Category Form ---

const BOOK_COLORS = ["#24c9f4", "#6c72ff", "#ff5c88", "#2fcf7f", "#f0782d", "#f4b740", "#a9abb8", "#35d39a"];

function CategoryForm({
  onSaved,
  onCancel,
  categoryCount,
}: {
  onSaved: (c: BlogCategory) => void;
  onCancel: () => void;
  categoryCount: number;
}) {
  const [form, setForm] = useState<BlogCategoryCreate>({
    name: "",
    slug: "",
    description: "",
    icon: "📖",
    color: BOOK_COLORS[categoryCount % BOOK_COLORS.length],
    sortOrder: 0,
  });
  const [saving, setSaving] = useState(false);

  function autoSlug(name: string) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9一-鿿]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  async function handleSubmit(ev: FormEvent) {
    ev.preventDefault();
    if (!form.name || !form.slug) return;
    setSaving(true);
    try {
      const cat = await api.createBlogCategory(form);
      onSaved(cat);
    } catch {
      alert("创建失败");
    }
    setSaving(false);
  }

  const BOOK_ICONS = ["📖", "📕", "📗", "📘", "📙", "📔", "📒", "📓"];

  return (
    <form className="blog-category-form" onSubmit={handleSubmit}>
      <strong>新增魔法书</strong>
      <div className="blog-form-row">
        <label>
          <span>书名</span>
          <input
            value={form.name}
            onChange={(e) => {
              const name = e.target.value;
              setForm((f) => ({ ...f, name, slug: autoSlug(name) }));
            }}
            required
          />
        </label>
        <label>
          <span>Slug</span>
          <input value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} required />
        </label>
      </div>
      <label>
        <span>描述</span>
        <input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
      </label>
      <div className="blog-form-row">
        <label>
          <span>图标</span>
          <div className="blog-icon-picker">
            {BOOK_ICONS.map((ic) => (
              <button
                key={ic}
                type="button"
                className={form.icon === ic ? "active" : ""}
                onClick={() => setForm((f) => ({ ...f, icon: ic }))}
              >
                {ic}
              </button>
            ))}
          </div>
        </label>
        <label>
          <span>颜色</span>
          <div className="blog-color-picker">
            {BOOK_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={form.color === c ? "active" : ""}
                style={{ background: c }}
                onClick={() => setForm((f) => ({ ...f, color: c }))}
              />
            ))}
          </div>
        </label>
      </div>
      <div className="blog-form-actions">
        <button type="button" onClick={onCancel}>取消</button>
        <button type="submit" disabled={saving}>{saving ? "创建中..." : "创建"}</button>
      </div>
    </form>
  );
}

// --- Posts View ---

function PostsView({
  category,
  onSelect,
  onEdit,
  onBack,
  onCreate,
  isAdmin,
  refreshSignal,
}: {
  category: BlogCategory;
  onSelect: (p: BlogPost) => void;
  onEdit: (p: BlogPost) => void;
  onBack: () => void;
  onCreate: () => void;
  isAdmin: boolean;
  refreshSignal: number;
}) {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = isAdmin ? api.adminGetBlogPostsFresh : api.getBlogPostsFresh;
    fetch(category.slug).then((p) => {
      setPosts(p);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [category.slug, isAdmin, refreshSignal]);

  function handleDelete(id: string) {
    if (!confirm("确定删除此文章？")) return;
    api.deleteBlogPost(id).then(() => {
      setPosts((prev) => prev.filter((p) => p.id !== id));
    }).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : "未知错误";
      if (msg.includes("session")) return; // 401 → session-expired event triggers re-login
      alert(`删除失败：${msg}`);
    });
  }

  function formatDate(s: string | null) {
    if (!s) return "";
    return new Date(s).toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit" });
  }

  return (
    <div className="blog-posts-view">
      <div className="blog-posts-header">
        <button className="blog-back-btn" onClick={onBack}>← 返回</button>
        <span className="blog-posts-category-icon">{category.icon}</span>
        <h2>{category.name}</h2>
        <span className="blog-posts-count">{posts.length} 篇文章</span>
      </div>
      {loading && (
        <div className="blog-loading">
          <div className="blog-loading-spinner" />
          <p>展开卷轴中...</p>
        </div>
      )}
      {!loading && posts.length === 0 && (
        <div className="blog-shelf-empty">
          <p>暂无文章</p>
        </div>
      )}
      <div className="blog-post-list">
        {posts.map((post, i) => (
          <div
            key={post.id}
            className="blog-post-scroll"
            style={{ animationDelay: `${i * 0.06}s` }}
            onClick={() => onSelect(post)}
          >
            <div className="blog-scroll-top" />
            <div className="blog-post-scroll-body">
              <div className="blog-post-scroll-title">{post.title}</div>
              <div className="blog-post-scroll-summary">{post.summary}</div>
              <div className="blog-post-scroll-meta">
                <span className="blog-post-scroll-date">{formatDate(post.publishedAt || post.createdAt)}</span>
                {post.status === "draft" && <span className="blog-post-draft-badge">草稿</span>}
              </div>
            </div>
            <div className="blog-scroll-bottom" />
            {isAdmin && (
              <div className="blog-post-admin-actions">
                <button onClick={(e) => { e.stopPropagation(); onEdit(post); }}>编辑</button>
                <button className="danger" onClick={(e) => { e.stopPropagation(); handleDelete(post.id); }}>删除</button>
              </div>
            )}
          </div>
        ))}
      </div>
      {isAdmin && (
        <button className="blog-add-btn" onClick={onCreate}>+ 撰写新文章</button>
      )}
    </div>
  );
}

// --- Reader View ---

function ReaderView({
  post,
  onBack,
  isAdmin,
}: {
  post: BlogPost;
  onBack: () => void;
  isAdmin: boolean;
}) {
  const [fullPost, setFullPost] = useState<BlogPost>(post);

  // Fetch full post content (list API omits content_md for efficiency)
  useEffect(() => {
    api.getBlogPost(post.id).then((p) => {
      setFullPost(p);
    }).catch(() => {});
  }, [post.id]);


  function formatDate(s: string) {
    return new Date(s).toLocaleDateString("zh-CN", {
      year: "numeric", month: "long", day: "numeric",
    });
  }

  return (
    <div className="blog-reader">
      <div className="blog-reader-header">
        <button className="blog-back-btn" onClick={onBack}>← 返回</button>
        <h2>{fullPost.title}</h2>
      </div>
      <div className="blog-scroll-content">
        <div className="blog-scroll-ornament-top" />
        <div className="blog-scroll-body">
          <div className="blog-scroll-meta">
            {fullPost.publishedAt && <span>发布于 {formatDate(fullPost.publishedAt)}</span>}
          </div>
          <div className="blog-markdown">
            <Suspense fallback={<div style={{color:"#8a9bbd",padding:20}}>加载中...</div>}>
              <Markdown remarkPlugins={[remarkGfm]}>{fullPost.contentMd}</Markdown>
            </Suspense>
          </div>
        </div>
        <div className="blog-scroll-ornament-bottom" />
      </div>

      <BlogComments postId={post.id} isAdmin={isAdmin} />
    </div>
  );
}

// --- Post Editor ---

function PostEditor({
  post,
  categories,
  defaultCategoryId,
  onBack,
  onSaved,
  onSaveComplete,
}: {
  post: BlogPost | null;
  categories: BlogCategory[];
  defaultCategoryId: string;
  onBack: () => void;
  onSaved: () => void;
  onSaveComplete?: () => void;
}) {
  const [form, setForm] = useState<BlogPostCreate>({
    slug: post?.slug ?? "",
    title: post?.title ?? "",
    summary: post?.summary ?? "",
    contentMd: post?.contentMd ?? "",
    coverUrl: post?.coverUrl ?? "",
    status: post?.status ?? "draft",
    categoryId: post?.categoryId ?? defaultCategoryId,
  });
  const markdownFileRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [markdownFileName, setMarkdownFileName] = useState("");
  const [markdownFileError, setMarkdownFileError] = useState("");

  // Fetch full post content when editing (list API omits contentMd)
  useEffect(() => {
    if (!post) return;
    api.getBlogPost(post.id).then((full) => {
      setForm((f) => ({ ...f, contentMd: full.contentMd }));
    }).catch(() => {});
  }, [post?.id]);

  async function handleMarkdownFile(ev: ChangeEvent<HTMLInputElement>) {
    const input = ev.currentTarget;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;

    if (!/\.(md|markdown)$/i.test(file.name)) {
      setMarkdownFileError("请选择 .md 或 .markdown 文档");
      return;
    }
    if (file.size > MAX_BLOG_MARKDOWN_SIZE) {
      setMarkdownFileError("Markdown 文档不能超过 2 MB");
      return;
    }

    try {
      const imported = parseBlogMarkdownDocument(await file.text(), file.name);
      if (!imported.contentMd.trim()) {
        setMarkdownFileError("Markdown 文档内容不能为空");
        return;
      }
      const categoryId = resolveImportedCategoryId(imported.category, categories);
      setForm((current) => ({
        ...current,
        title: imported.title || current.title,
        slug: imported.slug || current.slug,
        summary: imported.summary || current.summary,
        contentMd: imported.contentMd,
        coverUrl: imported.coverUrl || current.coverUrl,
        status: imported.status || current.status,
        categoryId: categoryId || current.categoryId,
      }));
      setMarkdownFileName(file.name);
      setMarkdownFileError("");
    } catch {
      setMarkdownFileError("文档读取失败，请重新选择");
    }
  }

  async function handleSubmit(ev: FormEvent) {
    ev.preventDefault();
    if (!form.title || !form.slug) return;
    setSaving(true);
    const jobId = crypto.randomUUID();

    if (post) {
      saveQueue.enqueue({
        id: jobId,
        label: "保存文章",
        execute: () => api.updateBlogPost(post.id, form),
        onComplete: () => onSaveComplete?.(),
      });
    } else {
      saveQueue.enqueue({
        id: jobId,
        label: "创建文章",
        execute: () => api.createBlogPost(form),
        onComplete: () => onSaveComplete?.(),
      });
    }
    setSaving(false);
    onSaved();
  }

  return (
    <form className="blog-editor" onSubmit={handleSubmit}>
      <div className="blog-editor-header">
        <button type="button" className="blog-back-btn" onClick={onBack}>← 返回</button>
        <strong>{post ? "编辑文章" : "撰写新文章"}</strong>
      </div>
      <div className="blog-editor-body">
        <div className="blog-markdown-upload-field">
          <input
            ref={markdownFileRef}
            type="file"
            accept=".md,.markdown,text/markdown"
            hidden
            onChange={handleMarkdownFile}
          />
          <button
            type="button"
            className={`admin-markdown-upload blog-markdown-upload${markdownFileError ? " has-error" : ""}`}
            onClick={() => markdownFileRef.current?.click()}
          >
            <span className="admin-markdown-upload-icon">MD</span>
            <span className="admin-markdown-upload-copy">
              <strong>{markdownFileName || "选择 Markdown 文档"}</strong>
              <span>
                {form.contentMd
                  ? `当前正文 ${form.contentMd.length.toLocaleString()} 个字符，点击可替换`
                  : "点击上传 .md 或 .markdown 文件，最大 2 MB"}
              </span>
            </span>
            <span className="admin-markdown-upload-action">
              {form.contentMd ? "重新上传" : "选择文件"}
            </span>
          </button>
          {markdownFileError && (
            <span className="admin-markdown-upload-error">{markdownFileError}</span>
          )}
        </div>
        <div className="blog-form-row">
          <label>
            <span>标题</span>
            <input
              value={form.title}
              onChange={(e) => {
                const title = e.target.value;
                setForm((f) => ({
                  ...f,
                  title,
                  slug: post ? f.slug : autoSlug(title),
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
          <span>摘要</span>
          <input
            value={form.summary}
            onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
          />
        </label>
        <div className="blog-form-row">
          <label>
            <span>分类</span>
            <select
              value={form.categoryId}
              onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
            >
              <option value="">未分类</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
              ))}
            </select>
          </label>
          <label>
            <span>状态</span>
            <select
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
            >
              <option value="draft">草稿</option>
              <option value="published">发布</option>
            </select>
          </label>
        </div>
        <label>
          <span>内容 (Markdown)</span>
          <textarea
            className="blog-editor-content"
            rows={16}
            value={form.contentMd}
            onChange={(e) => setForm((f) => ({ ...f, contentMd: e.target.value }))}
            required
          />
        </label>
      </div>
      <div className="blog-form-actions">
        <button type="button" onClick={onBack}>取消</button>
        <button type="submit" disabled={saving}>{saving ? "保存中..." : "保存"}</button>
      </div>
    </form>
  );
}
