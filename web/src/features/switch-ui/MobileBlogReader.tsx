import { lazy, Suspense, useEffect, useMemo, useState, type CSSProperties } from "react";
import remarkGfm from "remark-gfm";
import { api } from "../../api/client";
import type { BlogCategory, BlogPost } from "../../api/types";
import { useAdminStore } from "../../stores/adminStore";

const Markdown = lazy(() => import("react-markdown"));

interface MobileBlogReaderProps {
  onClose: () => void;
}

type MobileBlogView = "categories" | "posts" | "reader";

function formatDate(value: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function categoryInitial(name: string) {
  return Array.from(name.trim())[0] ?? "#";
}

export function MobileBlogReader({ onClose }: MobileBlogReaderProps) {
  const profile = useAdminStore((state) => state.profile);
  const [view, setView] = useState<MobileBlogView>("categories");
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<BlogCategory | null>(null);
  const [selectedPost, setSelectedPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [postsLoading, setPostsLoading] = useState(false);
  const [readerLoading, setReaderLoading] = useState(false);
  const [error, setError] = useState("");
  const [retrySignal, setRetrySignal] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    Promise.all([api.getBlogCategoriesFresh(), api.getBlogPosts()])
      .then(([cats, allPosts]) => {
        if (cancelled) return;
        const countMap: Record<string, number> = {};
        for (const post of allPosts) {
          countMap[post.categoryId] = (countMap[post.categoryId] ?? 0) + 1;
        }
        setCategories(cats.map((cat) => ({
          ...cat,
          postCount: cat.postCount || countMap[cat.id] || 0,
        })));
        setPosts(allPosts);
      })
      .catch(() => {
        if (!cancelled) setError("博客加载失败");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [retrySignal]);

  const categoryPosts = useMemo(() => {
    if (!selectedCategory) return [];
    return posts.filter((post) => post.categoryId === selectedCategory.id);
  }, [posts, selectedCategory]);

  const ownerName = profile?.displayName?.trim() || "MEO";
  const ownerInitial = Array.from(ownerName)[0] ?? "M";
  const titleText = view === "reader"
    ? selectedPost?.title ?? "正在阅读"
    : view === "posts"
      ? selectedCategory?.name ?? "文章列表"
      : `${ownerName} 的博客仓库`;
  const subtitleText = view === "reader"
    ? "正文阅读"
    : view === "posts"
      ? "分类文章"
      : "分类索引与文章";

  async function openCategory(category: BlogCategory) {
    setSelectedCategory(category);
    setSelectedPost(null);
    setView("posts");
    if (posts.some((post) => post.categoryId === category.id)) return;

    setPostsLoading(true);
    try {
      const next = await api.getBlogPosts(category.slug);
      setPosts((prev) => {
        const otherPosts = prev.filter((post) => post.categoryId !== category.id);
        return [...otherPosts, ...next];
      });
    } catch {
      setError("文章列表加载失败");
    } finally {
      setPostsLoading(false);
    }
  }

  async function openPost(post: BlogPost) {
    setSelectedPost(post);
    setView("reader");
    if (post.contentMd) return;

    setReaderLoading(true);
    try {
      const full = await api.getBlogPost(post.id);
      setSelectedPost(full);
      setPosts((prev) => prev.map((item) => (item.id === full.id ? full : item)));
    } catch {
      setError("文章内容加载失败");
    } finally {
      setReaderLoading(false);
    }
  }

  function goBack() {
    setError("");
    if (view === "reader") {
      setView("posts");
      setSelectedPost(null);
      return;
    }
    if (view === "posts") {
      setView("categories");
      setSelectedCategory(null);
      return;
    }
    onClose();
  }

  return (
    <aside className="mobile-blog-backdrop">
      <div className="mobile-blog-shell">
        <header className="mobile-blog-topbar">
          <button type="button" aria-label="返回" onClick={goBack}>
            ←
          </button>
          <div>
            <strong>{titleText}</strong>
            <span>{subtitleText}</span>
          </div>
          <button type="button" aria-label="关闭" onClick={onClose}>
            ×
          </button>
        </header>

        <main className="mobile-blog-body">
          {loading && (
            <div className="mobile-blog-state">
              <span className="mobile-blog-loader" />
              <strong>加载仓库中...</strong>
            </div>
          )}

          {!loading && error && (
            <div className="mobile-blog-state">
              <strong>{error}</strong>
              <button type="button" onClick={() => {
                setError("");
                setRetrySignal((value) => value + 1);
              }}>重试</button>
            </div>
          )}

          {!loading && !error && view === "categories" && (
            <section className="mobile-blog-repo-list" aria-label="博客分类">
              <div className="mobile-blog-profile-card">
                <span className="mobile-blog-avatar">
                  {profile?.avatarUrl ? (
                    <img src={profile.avatarUrl} alt="" />
                  ) : (
                    <span>{ownerInitial}</span>
                  )}
                </span>
                <div className="mobile-blog-profile-copy">
                  <strong>{ownerName} 的博客仓库</strong>
                  <span>{profile?.bio || "像翻阅 GitHub 仓库一样阅读文章"}</span>
                  <span className="mobile-blog-profile-stats">
                    <small>{categories.length} 个分类</small>
                    <small>{posts.length} 篇文章</small>
                  </span>
                </div>
              </div>
              {categories.length === 0 ? (
                <div className="mobile-blog-empty">暂无博客分类</div>
              ) : categories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  className="mobile-blog-repo-row"
                  onClick={() => void openCategory(category)}
                >
                  <span className="mobile-blog-repo-icon" style={{ "--repo-color": category.color } as CSSProperties}>
                    {category.icon || categoryInitial(category.name)}
                  </span>
                  <span className="mobile-blog-repo-copy">
                    <strong>{category.name}</strong>
                    <span>{category.description || "暂无简介"}</span>
                    <small><i className="mobile-blog-lang-dot" />{category.postCount || 0} 篇文章</small>
                  </span>
                </button>
              ))}
            </section>
          )}

          {!loading && !error && view === "posts" && selectedCategory && (
            <section className="mobile-blog-post-list" aria-label={`${selectedCategory.name} 文章`}>
              <div className="mobile-blog-repo-header">
                <span className="mobile-blog-repo-icon" style={{ "--repo-color": selectedCategory.color } as CSSProperties}>
                  {selectedCategory.icon || categoryInitial(selectedCategory.name)}
                </span>
                <div>
                  <strong>{selectedCategory.name}</strong>
                  <span>{selectedCategory.description || "文章归档"}</span>
                </div>
              </div>
              {postsLoading ? (
                <div className="mobile-blog-state compact">
                  <span className="mobile-blog-loader" />
                  <strong>同步文章...</strong>
                </div>
              ) : categoryPosts.length === 0 ? (
                <div className="mobile-blog-empty">这个分类还没有文章</div>
              ) : categoryPosts.map((post, index) => (
                <button
                  key={post.id}
                  type="button"
                  className="mobile-blog-issue-row"
                  onClick={() => void openPost(post)}
                >
                  <span className="mobile-blog-issue-dot" />
                  <span>
                    <strong>{post.title}</strong>
                    <small>#{String(index + 1).padStart(2, "0")} · {formatDate(post.publishedAt || post.createdAt)}</small>
                    {post.summary && <em>{post.summary}</em>}
                  </span>
                </button>
              ))}
            </section>
          )}

          {!loading && !error && view === "reader" && selectedPost && (
            <article className="mobile-blog-reader">
              <div className="mobile-blog-filebar">
                <span>README.md · 正文</span>
                <small>{formatDate(selectedPost.publishedAt || selectedPost.createdAt)}</small>
              </div>
              {readerLoading ? (
                <div className="mobile-blog-state compact">
                  <span className="mobile-blog-loader" />
                  <strong>拉取正文...</strong>
                </div>
              ) : (
                <div className="mobile-blog-markdown">
                  <Suspense fallback={<div className="mobile-blog-empty">渲染中...</div>}>
                    <Markdown remarkPlugins={[remarkGfm]}>{selectedPost.contentMd || selectedPost.summary}</Markdown>
                  </Suspense>
                </div>
              )}
            </article>
          )}
        </main>
      </div>
    </aside>
  );
}
