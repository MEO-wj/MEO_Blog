import { useEffect, useRef, useState, type FormEvent } from "react";
import { api } from "../../api/client";
import type { GuestbookMessage, GuestbookMessageCreate } from "../../api/types";
import { useAdminStore } from "../../stores/adminStore";
import { useWheelScroll } from "./useWheelScroll";

interface MessageWallModalProps {
  onClose: () => void;
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
  const scrollRef = useWheelScroll<HTMLDivElement>();
  const contentRef = useRef<HTMLTextAreaElement>(null);

  const { authenticated: isAdmin, profile } = useAdminStore();

  useEffect(() => {
    api.getGuestbookMessages().then((m) => {
      setMessages(m);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

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
      const msg = await api.createGuestbookMessage(data);
      msg.canDelete = true;
      setMessages((prev) => [msg, ...prev]);
      setContent("");
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
        const reply = await api.replyToGuestbookAsUser(messageId, {
          nickname: currentNickname,
          content: replyContent.trim(),
        });
        reply.canDelete = true;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? { ...m, replies: [...(m.replies || []), reply] }
              : m
          )
        );
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
        await api.deleteOwnGuestbookMessage(id);
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
        await api.deleteOwnGuestbookMessage(replyId);
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

  return (
    <aside className="switch-guestbook-backdrop" onClick={onClose}>
      <div className="switch-guestbook-card" onClick={(e) => e.stopPropagation()}>
        <div className="switch-guestbook-header">
          <span className="switch-guestbook-header-icon">📮</span>
          <strong>留言墙</strong>
          <button className="switch-guestbook-close-btn" type="button" aria-label="关闭" onClick={onClose}>
            ×
          </button>
        </div>

        <div ref={scrollRef} className="switch-guestbook-body">
          {loading ? (
            <div className="switch-guestbook-loading">
              <div className="switch-guestbook-loading-bar" />
              <span>Loading...</span>
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
