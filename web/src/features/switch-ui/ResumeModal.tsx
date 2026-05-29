import { useEffect, useRef, useState } from "react";
import { api } from "../../api/client";
import { useAdminStore } from "../../stores/adminStore";
import { useWheelScroll } from "./useWheelScroll";

interface ResumeModalProps {
  onClose: () => void;
}

export function ResumeModal({ onClose }: ResumeModalProps) {
  const [resumeUrl, setResumeUrl] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useWheelScroll<HTMLDivElement>();

  const { authenticated: isAdmin, profile, setProfile } = useAdminStore();

  useEffect(() => {
    setLoading(true);
    setError(null);
    api.getResume().then((res) => {
      setResumeUrl(res.url);
      setLoading(false);
    }).catch(() => {
      setLoading(false);
      setError("加载失败，请检查网络");
    });
  }, [retryCount]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await api.uploadResume(file);
      setResumeUrl(res.url);
      if (profile) {
        setProfile({ ...profile, resumeUrl: res.url });
      }
    } catch {
      // ignore
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <aside className="switch-resume-backdrop" onClick={onClose}>
      <div className="switch-resume-card" onClick={(e) => e.stopPropagation()}>
        <div className="switch-resume-header">
          <span className="switch-resume-header-icon">📄</span>
          <strong>我的简历</strong>
          <button className="switch-resume-close-btn" type="button" aria-label="关闭" onClick={onClose}>
            ×
          </button>
        </div>

        <div ref={scrollRef} className="switch-resume-body">
          {loading ? (
            <div className="switch-resume-loading">
              <div className="switch-resume-loading-bar" />
              <span>Loading...</span>
            </div>
          ) : error ? (
            <div className="switch-resume-loading">
              <span>⚠️ {error}</span>
              <button
                className="switch-favorites-upload-btn"
                type="button"
                onClick={() => setRetryCount((c) => c + 1)}
              >
                重试
              </button>
            </div>
          ) : resumeUrl ? (
            <div className="switch-resume-image-wrapper">
              <img src={`${resumeUrl}${resumeUrl.includes("?") ? "&" : "?"}_t=${Date.now()}`} alt="简历" className="switch-resume-image" />
              {isAdmin && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={handleUpload}
                  />
                  <button
                    className="switch-resume-replace-btn"
                    type="button"
                    disabled={uploading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {uploading ? "上传中..." : "更换简历"}
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="switch-resume-empty">
              {isAdmin ? (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={handleUpload}
                  />
                  <button
                    className="switch-resume-upload-btn"
                    type="button"
                    disabled={uploading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <span className="switch-resume-plus">+</span>
                    <span>{uploading ? "上传中..." : "上传简历"}</span>
                  </button>
                </>
              ) : (
                <div className="switch-resume-empty-placeholder">
                  <span className="switch-resume-plus">+</span>
                  <span>暂无简历</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
