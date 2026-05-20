import { useEffect, useRef, useState } from "react";
import { api } from "../../api/client";
import type { Favorite } from "../../api/types";
import { useAdminStore } from "../../stores/adminStore";
import { useWheelScroll } from "./useWheelScroll";

interface FavoritesModalProps {
  onClose: () => void;
}

/**
 * Generate deterministic pseudo-random layout for each quest notice.
 * Uses a simple seed-based PRNG so positions are stable across renders.
 */
function noticeLayout(index: number) {
  // Seed from index
  const s = (index * 2654435761) >>> 0; // Knuth multiplicative hash
  const r = (n: number) => ((s * (n + 1) * 7 + 13) % 1000) / 1000; // 0-1

  const rotation = (r(1) - 0.5) * 12; // -6° to +6°
  const width = 220 + Math.floor(r(2) * 60); // 220-280px

  // Grid-based placement with jitter for scattered look
  const cols = 4;
  const col = index % cols;
  const row = Math.floor(index / cols);
  const colW = 260;
  const rowH = 310;
  const baseX = 30 + col * colW;
  const baseY = 20 + row * rowH;
  const jitterX = (r(3) - 0.5) * 60;
  const jitterY = (r(4) - 0.5) * 40;

  const x = Math.max(10, baseX + jitterX);
  const y = Math.max(10, baseY + jitterY);
  const z = Math.floor(r(5) * 10) + 1;
  const hasSeal = index % 3 === 0;

  return { rotation, width, x, y, z, hasSeal };
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

  // Calculate board min-height based on last item position
  const boardHeight = favorites.length > 0
    ? (() => {
        const last = noticeLayout(favorites.length - 1);
        return last.y + 360;
      })()
    : 700;

  return (
    <aside className="switch-favorites-backdrop" onClick={onClose}>
      <div className="switch-favorites-card" onClick={(e) => e.stopPropagation()}>
        {/* Wooden plaque header */}
        <div className="switch-favorites-header">
          <span className="switch-favorites-header-icon">📜</span>
          <strong>冒险委托板</strong>
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
                {uploading ? "张贴中..." : "📌 张贴委托"}
              </button>
            </>
          )}
          <button className="switch-favorites-close-btn" type="button" aria-label="关闭" onClick={onClose}>
            ×
          </button>
        </div>

        {/* Quest board body */}
        <div ref={scrollRef} className="switch-favorites-body">
          {loading ? (
            <div className="switch-favorites-loading">
              <div className="switch-favorites-loading-bar" />
              <span>正在查阅委托...</span>
            </div>
          ) : favorites.length === 0 ? (
            <div className="switch-favorites-empty">
              <span className="switch-favorites-empty-icon">📋</span>
              <span>{isAdmin ? "点击「张贴委托」添加收藏" : "委托板空空如也"}</span>
            </div>
          ) : (
            <div className="switch-favorites-board" style={{ minHeight: boardHeight }}>
              {favorites.map((fav, index) => {
                const layout = noticeLayout(index);
                return (
                  <div
                    key={fav.id}
                    className="switch-favorites-notice"
                    style={{
                      left: `${layout.x}px`,
                      top: `${layout.y}px`,
                      "--notice-w": `${layout.width}px`,
                      "--notice-rot": `${layout.rotation}deg`,
                      "--notice-z": layout.z,
                      animationDelay: `${index * 0.08}s`,
                    } as React.CSSProperties}
                    onClick={() => setSelectedImage(fav)}
                  >
                    {/* Iron nail */}
                    <div className="switch-favorites-nail" />

                    {/* Parchment paper */}
                    <div className="switch-favorites-notice-paper">
                      {/* Photo */}
                      <div className="switch-favorites-notice-photo">
                        <img
                          src={fav.imageUrl}
                          alt={fav.title || `委托 ${index + 1}`}
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

                      {/* Text */}
                      {(fav.title || fav.description) && (
                        <div className="switch-favorites-notice-text">
                          {fav.title && <span className="switch-favorites-notice-title">{fav.title}</span>}
                          {fav.description && <span className="switch-favorites-notice-desc">{fav.description}</span>}
                        </div>
                      )}

                      {/* Wax seal */}
                      {layout.hasSeal && <div className="switch-favorites-seal" />}
                    </div>
                  </div>
                );
              })}
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
