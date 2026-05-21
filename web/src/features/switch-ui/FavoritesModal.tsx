import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../api/client";
import type { Favorite } from "../../api/types";
import { useAdminStore } from "../../stores/adminStore";
import { useWheelScroll } from "./useWheelScroll";

interface FavoritesModalProps {
  onClose: () => void;
}

/**
 * Generate deterministic pseudo-random layout for each quest notice.
 * Adjusts card size based on image aspect ratio.
 */
function noticeLayout(index: number, imgW?: number, imgH?: number) {
  // Seed from index
  const s = (index * 2654435761) >>> 0; // Knuth multiplicative hash
  const r = (n: number) => ((s * (n + 1) * 7 + 13) % 1000) / 1000; // 0-1

  const rotation = (r(1) - 0.5) * 12; // -6° to +6°

  // Determine card width and photo height based on image aspect ratio
  let width: number;
  let photoH: number;

  if (imgW && imgH && imgW > 0 && imgH > 0) {
    const ratio = imgW / imgH;
    if (ratio < 0.8) {
      // Tall/portrait: narrow card, taller photo
      width = 200 + Math.floor(r(2) * 30);
      photoH = 240 + Math.floor(r(6) * 40);
    } else if (ratio > 1.2) {
      // Wide/landscape: wider card, shorter photo
      width = 270 + Math.floor(r(2) * 40);
      photoH = 130 + Math.floor(r(6) * 30);
    } else {
      // Square-ish: balanced
      width = 230 + Math.floor(r(2) * 40);
      photoH = 170 + Math.floor(r(6) * 30);
    }
  } else {
    // Fallback for old data without dimensions
    width = 220 + Math.floor(r(2) * 60);
    photoH = 160;
  }

  const rowH = photoH + 120; // photo + text + padding

  // Grid-based placement with jitter for scattered look
  const cols = 4;
  const col = index % cols;
  const row = Math.floor(index / cols);
  const colW = 260;
  const baseX = 30 + col * colW;
  const baseY = 20 + row * rowH;
  const jitterX = (r(3) - 0.5) * 60;
  const jitterY = (r(4) - 0.5) * 40;

  const x = Math.max(10, baseX + jitterX);
  const y = Math.max(10, baseY + jitterY);
  const z = Math.floor(r(5) * 10) + 1;
  const hasSeal = index % 3 === 0;

  return { rotation, width, photoH, x, y, z, hasSeal };
}

interface DragState {
  id: string;
  offsetX: number;
  offsetY: number;
  currentX: number;
  currentY: number;
}

export function FavoritesModal({ onClose }: FavoritesModalProps) {
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<Favorite | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useWheelScroll<HTMLDivElement>();
  const boardRef = useRef<HTMLDivElement>(null);

  const { authenticated: isAdmin } = useAdminStore();

  useEffect(() => {
    setLoading(true);
    setError(null);
    api.getFavorites().then((f) => {
      setFavorites(f);
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

  // Drag handlers
  const handleMouseDown = useCallback((e: React.MouseEvent, fav: Favorite) => {
    if (!isAdmin || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    const board = boardRef.current;
    if (!board) return;

    const layout = noticeLayout(favorites.indexOf(fav), fav.width, fav.height);
    const favX = fav.posX ?? layout.x;
    const favY = fav.posY ?? layout.y;
    const boardRect = board.getBoundingClientRect();
    const scrollEl = scrollRef.current;

    setDrag({
      id: fav.id,
      offsetX: e.clientX - boardRect.left - (scrollEl ? scrollEl.scrollLeft : 0) - favX,
      offsetY: e.clientY - boardRect.top - (scrollEl ? scrollEl.scrollTop : 0) - favY,
      currentX: favX,
      currentY: favY,
    });
  }, [isAdmin, favorites, scrollRef]);

  useEffect(() => {
    if (!drag) return;

    const board = boardRef.current;
    if (!board) return;

    function onMouseMove(e: MouseEvent) {
      const boardRect = board!.getBoundingClientRect();
      const scrollEl = scrollRef.current;
      const newX = e.clientX - boardRect.left - (scrollEl ? scrollEl.scrollLeft : 0) - drag!.offsetX;
      const newY = e.clientY - boardRect.top - (scrollEl ? scrollEl.scrollTop : 0) - drag!.offsetY;
      setDrag((d) => d ? { ...d, currentX: Math.max(0, newX), currentY: Math.max(0, newY) } : null);
    }

    async function onMouseUp() {
      const finalX = Math.round(drag!.currentX);
      const finalY = Math.round(drag!.currentY);
      const favId = drag!.id;
      setDrag(null);

      // Update local state immediately
      setFavorites((prev) =>
        prev.map((f) => f.id === favId ? { ...f, posX: finalX, posY: finalY } : f)
      );

      // Persist to server
      try {
        await api.updateFavoritePosition(favId, finalX, finalY);
      } catch {
        // ignore — position stays in local state
      }
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [drag, scrollRef]);

  // Calculate board min-height based on item positions
  const boardHeight = favorites.length > 0
    ? (() => {
        let maxY = 700;
        favorites.forEach((fav, index) => {
          const layout = noticeLayout(index, fav.width, fav.height);
          const y = fav.posY ?? layout.y;
          const h = layout.photoH;
          maxY = Math.max(maxY, y + h + 160);
        });
        return maxY;
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
          ) : error ? (
            <div className="switch-favorites-empty">
              <span className="switch-favorites-empty-icon">⚠️</span>
              <span>{error}</span>
              <button
                className="switch-favorites-upload-btn"
                type="button"
                onClick={() => setRetryCount((c) => c + 1)}
              >
                重试
              </button>
            </div>
          ) : favorites.length === 0 ? (
            <div className="switch-favorites-empty">
              <span className="switch-favorites-empty-icon">📋</span>
              <span>{isAdmin ? "点击「张贴委托」添加收藏" : "委托板空空如也"}</span>
            </div>
          ) : (
            <div ref={boardRef} className="switch-favorites-board" style={{ minHeight: boardHeight }}>
              {favorites.map((fav, index) => {
                const layout = noticeLayout(index, fav.width, fav.height);
                const isDragging = drag?.id === fav.id;
                const x = isDragging ? drag!.currentX : (fav.posX ?? layout.x);
                const y = isDragging ? drag!.currentY : (fav.posY ?? layout.y);
                return (
                  <div
                    key={fav.id}
                    className={`switch-favorites-notice${isDragging ? " is-dragging" : ""}${isAdmin ? " is-admin-draggable" : ""}`}
                    style={{
                      left: `${x}px`,
                      top: `${y}px`,
                      "--notice-w": `${layout.width}px`,
                      "--notice-rot": isDragging ? "0deg" : `${layout.rotation}deg`,
                      "--notice-z": isDragging ? 9999 : layout.z,
                      "--notice-photo-h": `${layout.photoH}px`,
                      animationDelay: isDragging ? undefined : `${index * 0.08}s`,
                    } as React.CSSProperties}
                    onClick={() => { if (!isDragging) setSelectedImage(fav); }}
                    onMouseDown={(e) => handleMouseDown(e, fav)}
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
                        {isAdmin && !isDragging && (
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
                      {layout.hasSeal && !isDragging && <div className="switch-favorites-seal" />}
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
