import { useEffect, useRef, useState } from "react";
import { api } from "../../api/client";
import type { Favorite } from "../../api/types";
import { useAdminStore } from "../../stores/adminStore";
import { useWheelScroll } from "./useWheelScroll";

interface FavoritesModalProps {
  onClose: () => void;
}

export function FavoritesModal({ onClose }: FavoritesModalProps) {
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<Favorite | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useWheelScroll<HTMLDivElement>();

  const { authenticated: isAdmin } = useAdminStore();

  useEffect(() => {
    api.getFavorites().then((f) => {
      setFavorites(f);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fav = await api.createFavorite(file);
      setFavorites((prev) => [fav, ...prev]);
    } catch {
      // ignore
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.deleteFavorite(id);
      setFavorites((prev) => prev.filter((f) => f.id !== id));
      if (selectedImage?.id === id) setSelectedImage(null);
    } catch {
      // ignore
    }
  }

  return (
    <aside className="switch-favorites-backdrop" onClick={onClose}>
      <div className="switch-favorites-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="switch-favorites-header">
          <span className="switch-favorites-header-icon">⭐</span>
          <strong>重要收藏</strong>
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
                className="switch-favorites-upload-btn"
                type="button"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploading ? "上传中..." : "+ 添加"}
              </button>
            </>
          )}
          <button className="switch-favorites-close-btn" type="button" aria-label="关闭" onClick={onClose}>
            ×
          </button>
        </div>

        {/* Body */}
        <div ref={scrollRef} className="switch-favorites-body">
          {loading ? (
            <div className="switch-favorites-loading">
              <div className="switch-favorites-loading-bar" />
              <span>Loading...</span>
            </div>
          ) : favorites.length === 0 ? (
            <div className="switch-favorites-empty">
              <span className="switch-favorites-empty-icon">✨</span>
              <span>{isAdmin ? "点击上方 + 添加 收藏图片" : "暂无收藏"}</span>
            </div>
          ) : (
            <div className="switch-favorites-credits">
              {/* Cinematic intro */}
              <div className="switch-favorites-intro">
                <div className="switch-favorites-star-field">
                  {Array.from({ length: 20 }).map((_, i) => (
                    <div key={i} className="switch-favorites-star" style={{
                      left: `${Math.random() * 100}%`,
                      animationDelay: `${Math.random() * 3}s`,
                      animationDuration: `${2 + Math.random() * 3}s`,
                    }} />
                  ))}
                </div>
                <h2 className="switch-favorites-title">MY COLLECTION</h2>
                <p className="switch-favorites-subtitle">珍藏的美好瞬间</p>
              </div>

              {/* Gallery items */}
              {favorites.map((fav, index) => (
                <div
                  key={fav.id}
                  className="switch-favorites-item"
                  style={{ animationDelay: `${index * 0.1}s` }}
                  onClick={() => setSelectedImage(fav)}
                >
                  <div className="switch-favorites-item-frame">
                    <img src={fav.imageUrl} alt={fav.title || `收藏 ${index + 1}`} />
                    {isAdmin && (
                      <button
                        className="switch-favorites-delete-btn"
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(fav.id);
                        }}
                      >
                        ×
                      </button>
                    )}
                  </div>
                  {(fav.title || fav.description) && (
                    <div className="switch-favorites-item-info">
                      {fav.title && <h3>{fav.title}</h3>}
                      {fav.description && <p>{fav.description}</p>}
                    </div>
                  )}
                </div>
              ))}

              {/* Cinematic outro */}
              <div className="switch-favorites-outro">
                <div className="switch-favorites-divider" />
                <p>THE END</p>
                <div className="switch-favorites-divider" />
              </div>
            </div>
          )}
        </div>

        {/* Lightbox */}
        {selectedImage && (
          <div className="switch-favorites-lightbox" onClick={() => setSelectedImage(null)}>
            <img src={selectedImage.imageUrl} alt={selectedImage.title} />
            {selectedImage.title && <div className="switch-favorites-lightbox-title">{selectedImage.title}</div>}
          </div>
        )}
      </div>
    </aside>
  );
}
