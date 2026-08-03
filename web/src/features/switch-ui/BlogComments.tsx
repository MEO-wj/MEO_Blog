import { useEffect, useState, type FormEvent } from "react";
import { api } from "../../api/client";
import type { BlogComment } from "../../api/types";

interface BlogCommentsProps {
  postId: string;
  isAdmin?: boolean;
  compact?: boolean;
}

function formatCommentDate(value: string) {
  return new Date(value).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function BlogComments({ postId, isAdmin = false, compact = false }: BlogCommentsProps) {
  const [comments, setComments] = useState<BlogComment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.getBlogComments(postId)
      .then((items) => {
        if (!cancelled) setComments(items);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [postId]);

  async function handleDelete(commentId: string) {
    try {
      await api.deleteBlogComment(postId, commentId);
      setComments((current) => current.filter((comment) => comment.id !== commentId));
    } catch (error) {
      const message = error instanceof Error ? error.message : "未知错误";
      if (!message.includes("session")) alert(`删除失败：${message}`);
    }
  }

  return (
    <section className={`blog-comments${compact ? " is-compact" : ""}`}>
      <h3>评论 ({comments.length})</h3>
      {loading && <p className="blog-comments-loading">加载评论中...</p>}
      {!loading && comments.length === 0 && (
        <p className="blog-comments-empty">还没有已公开的评论。</p>
      )}
      {comments.map((comment) => (
        <div key={comment.id} className="blog-comment">
          <div className="blog-comment-header">
            <span className="blog-comment-avatar">{comment.authorName.charAt(0).toUpperCase()}</span>
            <span className="blog-comment-name">{comment.authorName}</span>
            <span className="blog-comment-date">{formatCommentDate(comment.createdAt)}</span>
            {isAdmin && (
              <button
                type="button"
                className="blog-comment-delete"
                onClick={() => void handleDelete(comment.id)}
              >
                删除
              </button>
            )}
          </div>
          <div className="blog-comment-content">{comment.content}</div>
        </div>
      ))}
      <CommentForm postId={postId} />
    </section>
  );
}

function CommentForm({ postId }: { postId: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submissionMessage, setSubmissionMessage] = useState("");
  const [submissionFailed, setSubmissionFailed] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() || !content.trim()) return;
    setSubmitting(true);
    setSubmissionMessage("");
    setSubmissionFailed(false);
    try {
      const comment = await api.createBlogComment(postId, {
        authorName: name.trim(),
        authorEmail: email.trim(),
        content: content.trim(),
      });
      setContent("");
      setSubmissionMessage(comment.moderationStatus === "pending"
        ? "评论已提交，审核通过后会公开显示。"
        : "评论已发布。");
    } catch {
      setSubmissionFailed(true);
      setSubmissionMessage("评论提交失败，请稍后重试。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="blog-comment-form" onSubmit={handleSubmit}>
      <div className="blog-comment-form-row">
        <input
          placeholder="昵称 *"
          maxLength={50}
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
        <input
          placeholder="邮箱（可选）"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>
      <textarea
        placeholder="写下你的评论..."
        rows={3}
        maxLength={2000}
        value={content}
        onChange={(event) => setContent(event.target.value)}
        required
      />
      <div className="blog-comment-form-footer">
        {submissionMessage && (
          <span className={submissionFailed ? "is-error" : ""} role="status">
            {submissionMessage}
          </span>
        )}
        <button type="submit" disabled={submitting}>
          {submitting ? "提交中..." : "提交评论"}
        </button>
      </div>
    </form>
  );
}