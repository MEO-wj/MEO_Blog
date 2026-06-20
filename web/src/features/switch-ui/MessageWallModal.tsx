import { useEffect, useRef, useState, type FormEvent } from "react";
import { api } from "../../api/client";
import type { GuestbookMessage, GuestbookMessageCreate, GuestbookModerationStats } from "../../api/types";
import { useAdminStore } from "../../stores/adminStore";
import { useWheelScroll } from "./useWheelScroll";

interface MessageWallModalProps {
  onClose: () => void;
}

const GUESTBOOK_OWNER_TOKENS_KEY = "guestbook_owner_tokens";

function readOwnerTokens(): Record<string, string> {
  try {
    const raw = localStorage.getItem(GUESTBOOK_OWNER_TOKENS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeOwnerToken(messageId: string, token: string) {
  if (!messageId || !token) return;
  try {
    const tokens = readOwnerTokens();
    tokens[messageId] = token;
    localStorage.setItem(GUESTBOOK_OWNER_TOKENS_KEY, JSON.stringify(tokens));
  } catch {
    // Ignore private-mode or quota failures; server still owns validation.
  }
}

function removeOwnerToken(messageId: string) {
  try {
    const tokens = readOwnerTokens();
    delete tokens[messageId];
    localStorage.setItem(GUESTBOOK_OWNER_TOKENS_KEY, JSON.stringify(tokens));
  } catch {
    // ignore
  }
}

function markOwnedMessages(messages: GuestbookMessage[]): GuestbookMessage[] {
  const tokens = readOwnerTokens();
  return messages.map((message) => ({
    ...message,
    canDelete: message.canDelete || Boolean(tokens[message.id]),
    replies: (message.replies || []).map((reply) => ({
      ...reply,
      canDelete: reply.canDelete || Boolean(tokens[reply.id]),
    })),
  }));
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "刚刚";
  if (mins < 60) return `${mins}分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}天前`;
  return d.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
}

function PixelAvatar({ name, url, size = 40 }: { name: string; url?: string; size?: number }) {
  if (url) {
    return (
      <div className="switch-guestbook-avatar" style={{ width: size, height: size }}>
        <img src={url} alt={name} />
      </div>
    );
  }
  return (
    <div className="switch-guestbook-avatar" style={{ width: size, height: size }}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

export function MessageWallModal({ onClose }: MessageWallModalProps) {
  const [messages, setMessages] = useState<GuestbookMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [nickname, setNickname] = useState(() => localStorage.getItem("guestbook_nickname") || "");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [replySubmitting, setReplySubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [moderationOpen, setModerationOpen] = useState(false);
  const [moderationLoading, setModerationLoading] = useState(false);
  const [pendingMessages, setPendingMessages] = useState<GuestbookMessage[]>([]);
  const [moderationStats, setModerationStats] = useState<GuestbookModerationStats>({ pending: 0, published: 0 });
  const [moderatingId, setModeratingId] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const scrollRef = useWheelScroll<HTMLDivElement>();
  const contentRef = useRef<HTMLTextAreaElement>(null);

  const { authenticated: isAdmin, profile } = useAdminStore();

  useEffect(() => {
    setLoading(true);
    setError(null);
    api.getGuestbookMessages().then((m) => {
      setMessages(markOwnedMessages(m));
      setLoading(false);
    }).catch(() => {
      setLoading(false);
      setError("加载失败，请检查网络");
    });
  }, [retryCount]);

  useEffect(() => {
    if (!isAdmin) {
      setModerationOpen(false);
      setPendingMessages([]);
      setModerationStats({ pending: 0, published: 0 });
      return;
    }
    let cancelled = false;
    setModerationLoading(true);
    api.getGuestbookModeration()
      .then((queue) => {
        if (cancelled) return;
        setPendingMessages(queue.messages);
        setModerationStats(queue.stats);
      })
      .catch(() => {
        if (!cancelled) setNotice("审核列表加载失败");
      })
      .finally(() => {
        if (!cancelled) setModerationLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isAdmin, retryCount]);

  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.style.height = "auto";
      contentRef.current.style.height = contentRef.current.scrollHeight + "px";
    }
  }, [content]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!nickname.trim() || !content.trim() || submitting) return;
    setSubmitting(true);
    try {
      const data: GuestbookMessageCreate = {
        nickname: nickname.trim(),
        content: content.trim(),
      };
      const { message: msg, ownerToken } = await api.createGuestbookMessage(data);
      writeOwnerToken(msg.id, ownerToken);
      msg.canDelete = true;
      setContent("");
      setNotice("留言已提交，审核通过后会显示在留言墙上");
      localStorage.setItem("guestbook_nickname", nickname.trim());
      if (scrollRef.current) scrollRef.current.scrollTop = 0;
    } catch {
      // ignore
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReply(messageId: string) {
    if (!replyContent.trim() || replySubmitting) return;
    const currentNickname = nickname.trim() || "匿名";
    setReplySubmitting(true);
    try {
      if (isAdmin) {
        const reply = await api.replyToGuestbookMessage(messageId, {
          content: replyContent.trim(),
          adminDisplayName: profile?.displayName || "MEO",
          adminAvatarUrl: profile?.avatarUrl || "",
        });
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? { ...m, replies: [...(m.replies || []), reply] }
              : m
          )
        );
      } else {
        const { message: reply, ownerToken } = await api.replyToGuestbookAsUser(messageId, {
          nickname: currentNickname,
          content: replyContent.trim(),
        });
        writeOwnerToken(reply.id, ownerToken);
        setNotice("回复已提交，审核通过后会显示");
      }
      setReplyContent("");
      setReplyingTo(null);
    } catch {
      // ignore
    } finally {
      setReplySubmitting(false);
    }
  }

  async function handleDeleteMessage(id: string) {
    try {
      if (isAdmin) {
        await api.deleteGuestbookMessage(id);
      } else {
        await api.deleteOwnGuestbookMessage(id, readOwnerTokens()[id]);
        removeOwnerToken(id);
      }
      setMessages((prev) => prev.filter((m) => m.id !== id));
    } catch {
      // ignore
    }
  }

  async function handleDeleteReply(messageId: string, replyId: string) {
    try {
      if (isAdmin) {
        await api.deleteGuestbookReply(replyId);
      } else {
        await api.deleteOwnGuestbookMessage(replyId, readOwnerTokens()[replyId]);
        removeOwnerToken(replyId);
      }
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, replies: (m.replies || []).filter((r) => r.id !== replyId) }
            : m
        )
      );
    } catch {
      // ignore
    }
  }

  async function refreshModeration() {
    if (!isAdmin) return;
    setModerationLoading(true);
    try {
      const queue = await api.getGuestbookModeration();
      setPendingMessages(queue.messages);
      setModerationStats(queue.stats);
    } catch {
      setNotice("审核列表加载失败");
    } finally {
      setModerationLoading(false);
    }
  }

  async function handlePublishPending(id: string) {
    if (moderatingId) return;
    setModeratingId(id);
    try {
      const published = await api.publishGuestbookMessage(id);
      setPendingMessages((prev) => prev.filter((m) => m.id !== id));
      setModerationStats((prev) => ({
        pending: Math.max(0, prev.pending - 1),
        published: prev.published + 1,
      }));
      if (!published.parentId) {
        setMessages((prev) => [published, ...prev]);
      } else {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === published.parentId
              ? { ...m, replies: [...(m.replies || []), published] }
              : m
          )
        );
      }
    } catch {
      setNotice("审核通过失败");
    } finally {
      setModeratingId(null);
    }
  }

  async function handleDeletePending(id: string) {
    if (moderatingId) return;
    setModeratingId(id);
    try {
      await api.deleteGuestbookMessage(id);
      setPendingMessages((prev) => prev.filter((m) => m.id !== id));
      setModerationStats((prev) => ({
        ...prev,
        pending: Math.max(0, prev.pending - 1),
      }));
    } catch {
      setNotice("删除待审核留言失败");
    } finally {
      setModeratingId(null);
    }
  }

  return (
    <aside className="switch-guestbook-backdrop" onClick={onClose}>
      <div className="switch-guestbook-card" onClick={(e) => e.stopPropagation()}>
        <div className="switch-guestbook-header">
          <span className="switch-guestbook-header-icon">📮</span>
          <strong>留言墙</strong>
          {isAdmin && (
            <button
              className={`switch-guestbook-review-toggle ${moderationOpen ? "is-open" : ""}`}
              type="button"
              onClick={() => {
                setModerationOpen((v) => !v);
                if (!moderationOpen) void refreshModeration();
              }}
            >
              审核
              {moderationStats.pending > 0 && <span>{moderationStats.pending}</span>}
            </button>
          )}
          <button className="switch-guestbook-close-btn" type="button" aria-label="关闭" onClick={onClose}>
            ×
          </button>
        </div>

        <div ref={scrollRef} className="switch-guestbook-body">
          {notice && (
            <div className="switch-guestbook-notice">
              <span>{notice}</span>
              <button type="button" onClick={() => setNotice(null)}>×</button>
            </div>
          )}

          {isAdmin && moderationOpen && (
            <section className="switch-guestbook-review-panel" aria-label="留言审核">
              <div className="switch-guestbook-review-stats">
                <span>
                  <strong>{moderationStats.pending}</strong>
                  待审核
                </span>
                <span>
                  <strong>{moderationStats.published}</strong>
                  已发布
                </span>
                <button type="button" onClick={refreshModeration} disabled={moderationLoading}>
                  {moderationLoading ? "同步中" : "刷新"}
                </button>
              </div>
              {moderationLoading ? (
                <div className="switch-guestbook-review-empty">正在读取待审核留言...</div>
              ) : pendingMessages.length === 0 ? (
                <div className="switch-guestbook-review-empty">没有待审核留言</div>
              ) : (
                <div className="switch-guestbook-review-list">
                  {pendingMessages.map((msg) => (
                    <article key={msg.id} className="switch-guestbook-review-item">
                      <div className="switch-guestbook-review-meta">
                        <PixelAvatar name={msg.nickname} url={msg.avatarUrl} size={30} />
                        <strong>{msg.nickname}</strong>
                        {msg.parentId && <span>回复</span>}
                        <small>{formatTime(msg.createdAt)}</small>
                      </div>
                      <p>{msg.content}</p>
                      <div className="switch-guestbook-review-actions">
                        <button
                          type="button"
                          disabled={moderatingId === msg.id}
                          onClick={() => handlePublishPending(msg.id)}
                        >
                          通过
                        </button>
                        <button
                          type="button"
                          className="is-danger"
                          disabled={moderatingId === msg.id}
                          onClick={() => handleDeletePending(msg.id)}
                        >
                          删除
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}

          {loading ? (
            <div className="switch-guestbook-loading">
              <div className="switch-guestbook-loading-bar" />
              <span>Loading...</span>
            </div>
          ) : error ? (
            <div className="switch-guestbook-empty">
              <span className="switch-guestbook-empty-icon">⚠️</span>
              <span>{error}</span>
              <button
                className="switch-favorites-upload-btn"
                type="button"
                onClick={() => setRetryCount((c) => c + 1)}
              >
                重试
              </button>
            </div>
          ) : messages.length === 0 ? (
            <div className="switch-guestbook-empty">
              <span className="switch-guestbook-empty-icon">💬</span>
              <span>还没有留言，来留下第一条吧！</span>
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className="switch-guestbook-note">
                <div className="switch-guestbook-note-header">
                  <PixelAvatar name={msg.nickname} url={msg.avatarUrl} />
                  <span className="switch-guestbook-nickname">{msg.nickname}</span>
                  <span className="switch-guestbook-time">{formatTime(msg.createdAt)}</span>
                </div>
                <div className="switch-guestbook-content">{msg.content}</div>

                {/* All replies */}
                {(msg.replies || []).map((reply) => (
                  <div
                    key={reply.id}
                    className={`switch-guestbook-reply ${reply.isAdminReply ? "switch-guestbook-admin-reply" : "switch-guestbook-user-reply"}`}
                  >
                    <div className="switch-guestbook-reply-header">
                      {reply.isAdminReply ? (
                        <>
                          <span className="switch-guestbook-admin-badge">管理员</span>
                          {reply.adminAvatarUrl && (
                            <div className="switch-guestbook-admin-avatar">
                              <img src={reply.adminAvatarUrl} alt={reply.adminDisplayName} />
                            </div>
                          )}
                          <span className="switch-guestbook-admin-name">
                            {reply.adminDisplayName || "MEO"}
                          </span>
                        </>
                      ) : (
                        <>
                          <PixelAvatar name={reply.nickname} url={reply.avatarUrl} size={28} />
                          <span className="switch-guestbook-nickname">{reply.nickname}</span>
                        </>
                      )}
                      <span className="switch-guestbook-time">{formatTime(reply.createdAt)}</span>
                    </div>
                    <div className={reply.isAdminReply ? "switch-guestbook-admin-content" : "switch-guestbook-content"}>
                      {reply.content}
                    </div>
                    {(isAdmin || reply.canDelete) && (
                      <button
                        className="switch-guestbook-action-btn is-delete"
                        type="button"
                        onClick={() => handleDeleteReply(msg.id, reply.id)}
                      >
                        删除
                      </button>
                    )}
                  </div>
                ))}

                {/* Reply form */}
                {replyingTo === msg.id && (
                  <div className={`switch-guestbook-reply-form ${isAdmin ? "is-admin" : "is-user"}`}>
                    <textarea
                      autoFocus
                      placeholder={isAdmin ? "输入管理员回复..." : "输入回复内容..."}
                      value={replyContent}
                      onChange={(e) => setReplyContent(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleReply(msg.id);
                        }
                        if (e.key === "Escape") {
                          setReplyingTo(null);
                          setReplyContent("");
                        }
                      }}
                    />
                    <div className="switch-guestbook-reply-form-actions">
                      <button
                        className="switch-guestbook-action-btn"
                        type="button"
                        onClick={() => {
                          setReplyingTo(null);
                          setReplyContent("");
                        }}
                      >
                        取消
                      </button>
                      <button
                        className="switch-guestbook-action-btn"
                        type="button"
                        disabled={!replyContent.trim() || replySubmitting}
                        onClick={() => handleReply(msg.id)}
                      >
                        {replySubmitting ? "发送中..." : "回复"}
                      </button>
                    </div>
                  </div>
                )}

                {/* Action buttons */}
                {replyingTo !== msg.id && (
                  <div className="switch-guestbook-note-actions">
                    <button
                      className="switch-guestbook-action-btn"
                      type="button"
                      onClick={() => {
                        setReplyingTo(msg.id);
                        setReplyContent("");
                      }}
                    >
                      回复
                    </button>
                    {(isAdmin || msg.canDelete) && (
                      <button
                        className="switch-guestbook-action-btn is-delete"
                        type="button"
                        onClick={() => handleDeleteMessage(msg.id)}
                      >
                        删除
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <form className="switch-guestbook-form" onSubmit={handleSubmit}>
          <div className="switch-guestbook-form-row">
            <input
              type="text"
              placeholder="你的昵称"
              maxLength={30}
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              required
            />
          </div>
          <div className="switch-guestbook-form-row">
            <textarea
              ref={contentRef}
              placeholder="想问什么？留个言吧..."
              maxLength={500}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              required
            />
          </div>
          <div className="switch-guestbook-form-footer">
            <span className="switch-guestbook-char-count">{content.length}/500</span>
            <button
              className="switch-guestbook-submit"
              type="submit"
              disabled={!nickname.trim() || !content.trim() || submitting}
            >
              {submitting ? "发送中..." : "发送留言"}
            </button>
          </div>
        </form>
      </div>
    </aside>
  );
}
