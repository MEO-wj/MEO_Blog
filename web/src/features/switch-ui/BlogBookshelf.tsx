import { useEffect, useState, type FormEvent } from "react";
import Markdown from "react-markdown";
import { api } from "../../api/client";
import type { BlogCategory, BlogCategoryCreate, BlogPost, BlogPostCreate, BlogComment } from "../../api/types";
import { useAdminStore } from "../../stores/adminStore";
import { useWheelScroll } from "./useWheelScroll";

interface BlogBookshelfProps {
  onClose: () => void;
}

type View = "shelf" | "posts" | "reader" | "editor";

export function BlogBookshelf({ onClose }: BlogBookshelfProps) {
  const [view, setView] = useState<View>("shelf");
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<BlogCategory | null>(null);
  const [selectedPost, setSelectedPost] = useState<BlogPost | null>(null);
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [creatingPost, setCreatingPost] = useState(false);
  const { authenticated: isAdmin } = useAdminStore();
  const scrollRef = useWheelScroll<HTMLDivElement>();

  useEffect(() => {
    api.getBlogCategories().then((c) => {
      setCategories(c);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  function handleSelectCategory(cat: BlogCategory) {
    setSelectedCategory(cat);
    setView("posts");
  }

  function handleSelectPost(post: BlogPost) {
    setSelectedPost(post);
    setView("reader");
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
      setView("posts");
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
          {!loading && view === "shelf" && (
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
  const [postCounts, setPostCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    api.getBlogPosts().then((posts) => {
      const counts: Record<string, number> = {};
      for (const p of posts) {
        if (p.categoryId) {
          counts[p.categoryId] = (counts[p.categoryId] || 0) + 1;
        }
      }
      setPostCounts(counts);
    }).catch(() => {});
  }, []);

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
              <span className="blog-book-title">{cat.name}</span>
              <span className="blog-book-count">{postCounts[cat.id] || 0} 篇</span>
            </div>
            {isAdmin && (
              <button
                className="blog-book-delete"
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`确定删除分类"${cat.name}"？`)) {
                    api.deleteBlogCategory(cat.id).then(() => onDeleteCategory(cat.id));
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
}: {
  category: BlogCategory;
  onSelect: (p: BlogPost) => void;
  onEdit: (p: BlogPost) => void;
  onBack: () => void;
  onCreate: () => void;
  isAdmin: boolean;
}) {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = isAdmin ? api.adminGetBlogPosts : api.getBlogPosts;
    fetch(category.slug).then((p) => {
      setPosts(p);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [category.slug, isAdmin]);

  function handleDelete(id: string) {
    if (!confirm("确定删除此文章？")) return;
    api.deleteBlogPost(id).then(() => {
      setPosts((prev) => prev.filter((p) => p.id !== id));
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
  const [comments, setComments] = useState<BlogComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(true);

  useEffect(() => {
    api.getBlogComments(post.id).then((c) => {
      setComments(c);
      setLoadingComments(false);
    }).catch(() => setLoadingComments(false));
  }, [post.id]);

  function handleCommentCreated(comment: BlogComment) {
    setComments((prev) => [...prev, comment]);
  }

  function handleCommentDeleted(id: string) {
    setComments((prev) => prev.filter((c) => c.id !== id));
  }

  function formatDate(s: string) {
    return new Date(s).toLocaleDateString("zh-CN", {
      year: "numeric", month: "long", day: "numeric",
    });
  }

  return (
    <div className="blog-reader">
      <div className="blog-reader-header">
        <button className="blog-back-btn" onClick={onBack}>← 返回</button>
        <h2>{post.title}</h2>
      </div>
      <div className="blog-scroll-content">
        <div className="blog-scroll-ornament-top" />
        <div className="blog-scroll-body">
          <div className="blog-scroll-meta">
            {post.publishedAt && <span>发布于 {formatDate(post.publishedAt)}</span>}
          </div>
          <div className="blog-markdown">
            <Markdown>{post.contentMd}</Markdown>
          </div>
        </div>
        <div className="blog-scroll-ornament-bottom" />
      </div>

      <div className="blog-comments">
        <h3>评论 ({comments.length})</h3>
        {loadingComments && <p className="blog-comments-loading">加载评论中...</p>}
        {comments.map((c) => (
          <div key={c.id} className="blog-comment">
            <div className="blog-comment-header">
              <span className="blog-comment-avatar">{c.authorName.charAt(0).toUpperCase()}</span>
              <span className="blog-comment-name">{c.authorName}</span>
              <span className="blog-comment-date">{formatDate(c.createdAt)}</span>
              {isAdmin && (
                <button
                  className="blog-comment-delete"
                  onClick={() => {
                    api.deleteBlogComment(c.id).then(() => handleCommentDeleted(c.id));
                  }}
                >
                  删除
                </button>
              )}
            </div>
            <div className="blog-comment-content">{c.content}</div>
          </div>
        ))}
        <CommentForm postId={post.id} onCreated={handleCommentCreated} />
      </div>
    </div>
  );
}

// --- Comment Form ---

function CommentForm({
  postId,
  onCreated,
}: {
  postId: string;
  onCreated: (c: BlogComment) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(ev: FormEvent) {
    ev.preventDefault();
    if (!name.trim() || !content.trim()) return;
    setSubmitting(true);
    try {
      const comment = await api.createBlogComment(postId, {
        authorName: name.trim(),
        authorEmail: email.trim(),
        content: content.trim(),
      });
      onCreated(comment);
      setContent("");
    } catch {
      alert("评论提交失败");
    }
    setSubmitting(false);
  }

  return (
    <form className="blog-comment-form" onSubmit={handleSubmit}>
      <div className="blog-comment-form-row">
        <input
          placeholder="昵称 *"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          placeholder="邮箱（可选）"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <textarea
        placeholder="写下你的评论..."
        rows={3}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        required
      />
      <button type="submit" disabled={submitting}>
        {submitting ? "提交中..." : "提交评论"}
      </button>
    </form>
  );
}

// --- Post Editor ---

function PostEditor({
  post,
  categories,
  defaultCategoryId,
  onBack,
  onSaved,
}: {
  post: BlogPost | null;
  categories: BlogCategory[];
  defaultCategoryId: string;
  onBack: () => void;
  onSaved: () => void;
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
  const [saving, setSaving] = useState(false);

  function autoSlug(title: string) {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9一-鿿]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  async function handleSubmit(ev: FormEvent) {
    ev.preventDefault();
    if (!form.title || !form.slug) return;
    setSaving(true);
    try {
      if (post) {
        await api.updateBlogPost(post.id, form);
      } else {
        await api.createBlogPost(form);
      }
      onSaved();
    } catch {
      alert("保存失败");
    }
    setSaving(false);
  }

  return (
    <form className="blog-editor" onSubmit={handleSubmit}>
      <div className="blog-editor-header">
        <button type="button" className="blog-back-btn" onClick={onBack}>← 返回</button>
        <strong>{post ? "编辑文章" : "撰写新文章"}</strong>
      </div>
      <div className="blog-editor-body">
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
