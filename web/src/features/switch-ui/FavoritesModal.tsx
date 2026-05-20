import { useEffect, useRef, useState } from "react";
import { api } from "../../api/client";
import type { Favorite } from "../../api/types";
import { useAdminStore } from "../../stores/adminStore";
import { useWheelScroll } from "./useWheelScroll";

interface FavoritesModalProps {
  onClose: () => void;
}

/** Generate a stable "random" rotation for each photo based on its index */
function photoStyle(index: number): React.CSSProperties {
  // Deterministic pseudo-random using index
  const seed = ((index * 7 + 3) * 13) % 100;
  const rotation = ((seed % 7) - 3) * 1.2; // -3.6° to +3.6°
  const tapeOffset = ((seed * 3) % 20) - 10; // -10px to +10px
  const tapeSide = seed % 2 === 0 ? "left" : "right";

  return {
    "--photo-rotation": `${rotation}deg`,
    "--tape-offset": `${tapeOffset}px`,
    "--tape-side": tapeSide === "left" ? "12px" : "auto",
    "--tape-side-r": tapeSide === "right" ? "12px" : "auto",
  } as React.CSSProperties;
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
        {/* Cork board header */}
        <div className="switch-favorites-header">
          <span className="switch-favorites-header-icon">📌</span>
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
                {uploading ? "上传中..." : "📌 钉上去"}
              </button>
            </>
          )}
          <button className="switch-favorites-close-btn" type="button" aria-label="关闭" onClick={onClose}>
            ×
          </button>
        </div>

        {/* Photo wall body */}
        <div ref={scrollRef} className="switch-favorites-body">
          {loading ? (
            <div className="switch-favorites-loading">
              <div className="switch-favorites-loading-bar" />
              <span>Loading...</span>
            </div>
          ) : favorites.length === 0 ? (
            <div className="switch-favorites-empty">
              <span className="switch-favorites-empty-icon">📷</span>
              <span>{isAdmin ? "点击「钉上去」添加收藏照片" : "暂无收藏"}</span>
            </div>
          ) : (
            <div className="switch-favorites-wall">
              {favorites.map((fav, index) => (
                <div
                  key={fav.id}
                  className="switch-favorites-photo"
                  style={photoStyle(index)}
                  onClick={() => setSelectedImage(fav)}
                >
                  {/* Tape strip */}
                  <div className="switch-favorites-tape" />
                  {/* Photo frame */}
                  <div className="switch-favorites-photo-inner">
                    <img
                      src={fav.imageUrl}
                      alt={fav.title || `收藏 ${index + 1}`}
                      draggable={false}
                    />
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
                  {/* Caption */}
                  {(fav.title || fav.description) && (
                    <div className="switch-favorites-caption">
                      {fav.title && <span className="switch-favorites-caption-title">{fav.title}</span>}
                      {fav.description && <span className="switch-favorites-caption-desc">{fav.description}</span>}
                    </div>
                  )}
                </div>
              ))}
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
