import { useEffect, useMemo, useState } from "react";
import { api } from "../../api/client";
import type { BlogCommentModerationItem, BlogCommentModerationStats } from "../../api/types";

interface BlogCommentModerationProps {
  onPendingChange?: (count: number) => void;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function BlogCommentModeration({ onPendingChange }: BlogCommentModerationProps) {
  const [comments, setComments] = useState<BlogCommentModerationItem[]>([]);
  const [stats, setStats] = useState<BlogCommentModerationStats>({ pending: 0, published: 0 });
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function refresh() {
    setLoading(true);
    setMessage("");
    try {
      const queue = await api.getBlogCommentModeration();
      setComments(queue.comments);
      setStats(queue.stats);
      onPendingChange?.(queue.stats.pending);
    } catch {
      setMessage("评论审核队列加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const groups = useMemo(() => {
    const grouped = new Map<string, { title: string; comments: BlogCommentModerationItem[] }>();
    for (const comment of comments) {
      const group = grouped.get(comment.postId) ?? { title: comment.postTitle, comments: [] };
      group.comments.push(comment);
      grouped.set(comment.postId, group);
    }
    return Array.from(grouped.entries());
  }, [comments]);

  function removePending(commentId: string, published: boolean) {
    setComments((current) => current.filter((comment) => comment.id !== commentId));
    setStats((current) => {
      const next = {
        pending: Math.max(0, current.pending - 1),
        published: current.published + (published ? 1 : 0),
      };
      onPendingChange?.(next.pending);
      return next;
    });
  }

  async function publish(comment: BlogCommentModerationItem) {
    if (actingId) return;
    setActingId(comment.id);
    setMessage("");
    try {
      await api.publishBlogComment(comment.id);
      removePending(comment.id, true);
    } catch {
      setMessage("评论通过失败，请重试");
    } finally {
      setActingId(null);
    }
  }

  async function reject(comment: BlogCommentModerationItem) {
    if (actingId) return;
    setActingId(comment.id);
    setMessage("");
    try {
      await api.deleteBlogComment(comment.postId, comment.id);
      removePending(comment.id, false);
    } catch {
      setMessage("评论删除失败，请重试");
    } finally {
      setActingId(null);
    }
  }

  return (
    <div className="admin-comment-review">
      <div className="admin-project-list-header">
        <div>
          <strong>博客评论审核</strong>
          <span>{stats.pending} 条待审核 · {stats.published} 条已公开</span>
        </div>
        <button type="button" onClick={() => void refresh()} disabled={loading}>
          {loading ? "同步中..." : "刷新"}
        </button>
      </div>

      {message && <span className="admin-panel-msg admin-panel-msg-error">{message}</span>}
      {!loading && groups.length === 0 && (
        <div className="admin-comment-review-empty">当前没有待审核的博客评论</div>
      )}
      {groups.map(([postId, group]) => (
        <section key={postId} className="admin-comment-post-group">
          <header>
            <div>
              <small>评论所属文章</small>
              <strong>{group.title}</strong>
            </div>
            <span>{group.comments.length} 条待审</span>
          </header>
          {group.comments.map((comment) => (
            <article key={comment.id} className="admin-comment-review-item">
              <div className="admin-comment-review-meta">
                <strong>{comment.authorName}</strong>
                {comment.authorEmail && <span>{comment.authorEmail}</span>}
                <time>{formatDate(comment.createdAt)}</time>
              </div>
              <p>{comment.content}</p>
              <div className="admin-comment-review-actions">
                <button
                  type="button"
                  disabled={actingId === comment.id}
                  onClick={() => void publish(comment)}
                >
                  通过并公开
                </button>
                <button
                  type="button"
                  className="danger"
                  disabled={actingId === comment.id}
                  onClick={() => void reject(comment)}
                >
                  删除
                </button>
              </div>
            </article>
          ))}
        </section>
      ))}
    </div>
  );
}