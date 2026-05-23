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

const FAV_POS_KEY = "favorites_positions";

function loadPositions(): Record<string, { x: number; y: number }> {
  try {
    const raw = localStorage.getItem(FAV_POS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function savePositions(positions: Record<string, { x: number; y: number }>) {
  try {
    localStorage.setItem(FAV_POS_KEY, JSON.stringify(positions));
  } catch { /* quota exceeded */ }
}

function mergeWithPositions(favs: Favorite[], positions: Record<string, { x: number; y: number }>): Favorite[] {
  return favs.map((f) => {
    const pos = positions[f.id];
    if (pos) return { ...f, posX: pos.x, posY: pos.y };
    return f;
  });
}

export function FavoritesModal({ onClose }: FavoritesModalProps) {
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<Favorite | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const dragRef = useRef<{ id: string; offsetX: number; offsetY: number; el: HTMLElement } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useWheelScroll<HTMLDivElement>();
  const boardRef = useRef<HTMLDivElement>(null);

  const { authenticated: isAdmin } = useAdminStore();

  useEffect(() => {
    const positions = loadPositions();
    setLoading(true);
    setError(null);
    api.getFavorites().then((f) => {
      const merged = mergeWithPositions(f, positions);
      setFavorites(merged);
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

  // Drag handlers — use refs + direct DOM transform to avoid React batching issues
  const handleMouseDown = useCallback((e: React.MouseEvent, fav: Favorite, el: HTMLElement) => {
    if (!isAdmin || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    const board = boardRef.current;
    if (!board) return;

    const layout = noticeLayout(favorites.indexOf(fav), fav.width, fav.height);
    const favX = fav.posX ?? layout.x;
    const favY = fav.posY ?? layout.y;
    const boardRect = board.getBoundingClientRect();

    // Record mouse offset from the notice's top-left corner
    dragRef.current = {
      id: fav.id,
      offsetX: e.clientX - boardRect.left - favX,
      offsetY: e.clientY - boardRect.top - favY,
      el,
    };
    el.style.transform = "rotate(0deg) scale(1.05)";
    setDragId(fav.id);
  }, [isAdmin, favorites]);

  useEffect(() => {
    if (!dragId) return;

    let rafId = 0;
    let lastMouseEvent: MouseEvent | null = null;

    function onMouseMove(e: MouseEvent) {
      lastMouseEvent = e;
      if (!rafId) {
        rafId = requestAnimationFrame(() => {
          rafId = 0;
          const d = dragRef.current;
          if (!d) return;
          const ev = lastMouseEvent!;
          const boardRect = boardRef.current!.getBoundingClientRect();
          // Calculate target position relative to board
          const targetX = Math.max(0, ev.clientX - boardRect.left - d.offsetX);
          const targetY = Math.max(0, ev.clientY - boardRect.top - d.offsetY);
          // Get current base position from favorites state
          const fav = favorites.find((f) => f.id === d.id);
          const baseX = fav?.posX ?? 0;
          const baseY = fav?.posY ?? 0;
          // Apply as transform offset — does not fight with React's left/top
          const dx = targetX - baseX;
          const dy = targetY - baseY;
          d.el.style.transform = `translate(${dx}px, ${dy}px) rotate(0deg) scale(1.05)`;
        });
      }
    }

    function onMouseUp() {
      const d = dragRef.current;
      if (!d) return;

      // Read final position from transform
      const fav = favorites.find((f) => f.id === d.id);
      const baseX = fav?.posX ?? 0;
      const baseY = fav?.posY ?? 0;
      const match = d.el.style.transform.match(/translate\(([^,]+)px,\s*([^)]+)px\)/);
      const dx = match ? parseFloat(match[1]) : 0;
      const dy = match ? parseFloat(match[2]) : 0;
      const finalX = Math.round(baseX + dx);
      const finalY = Math.round(baseY + dy);

      // Update state first so React renders the new left/top immediately
      setFavorites((prev) => {
        const updated = prev.map((f) => f.id === d.id ? { ...f, posX: finalX, posY: finalY } : f);
        const positions: Record<string, { x: number; y: number }> = {};
        for (const f of updated) {
          if (f.posX != null && f.posY != null) positions[f.id] = { x: f.posX, y: f.posY };
        }
        savePositions(positions);
        return updated;
      });

      // Clear drag state — React will now render with new posX/posY
      d.el.style.transform = "";
      dragRef.current = null;
      setDragId(null);

      // Background save to server
      api.updateFavoritePosition(d.id, finalX, finalY).catch(() => {
        console.error("[favorites] background position save failed");
      });
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [dragId, favorites]);

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
    <>
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
                const isDragging = dragId === fav.id;
                const x = fav.posX ?? layout.x;
                const y = fav.posY ?? layout.y;
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
                    onMouseDown={(e) => handleMouseDown(e, fav, e.currentTarget)}
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
    </>
  );
}
