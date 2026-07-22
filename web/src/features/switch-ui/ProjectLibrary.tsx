import { useMemo, useState, type CSSProperties } from "react";
import type { SwitchHomeProject } from "./switchHomeData";

interface ProjectLibraryProps {
  projects: SwitchHomeProject[];
  onClose: () => void;
  onOpenProject: (project: SwitchHomeProject) => void;
}

interface ProjectLibraryButtonProps {
  selected: boolean;
  dragging: boolean;
  onSelect: () => void;
  onDeselect: () => void;
  onOpen: () => void;
  onHoverSound?: () => void;
  onClickSound?: () => void;
}

const PROJECT_NAME_COLLATOR = new Intl.Collator("zh-CN-u-co-pinyin", {
  usage: "sort",
  sensitivity: "base",
  numeric: true,
});

export function ProjectLibraryButton({
  selected,
  dragging,
  onSelect,
  onDeselect,
  onOpen,
  onHoverSound,
  onClickSound,
}: ProjectLibraryButtonProps) {
  return (
    <button
      type="button"
      className={`switch-project-more${selected ? " is-hovered" : ""}`}
      aria-label="显示更多项目"
      onMouseEnter={() => {
        if (!dragging) {
          onSelect();
          onHoverSound?.();
        }
      }}
      onMouseLeave={() => {
        if (!dragging) onDeselect();
      }}
      onClick={() => {
        onClickSound?.();
        onOpen();
      }}
    >
      <span className="switch-project-more-label">显示更多</span>
      <span className="switch-project-more-circle" aria-hidden="true">
        <span className="switch-project-more-grid">
          <i />
          <i />
          <i />
          <i />
        </span>
      </span>
    </button>
  );
}

export function ProjectLibrary({ projects, onClose, onOpenProject }: ProjectLibraryProps) {
  const [alphabetical, setAlphabetical] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const visibleProjects = useMemo(() => {
    if (!alphabetical) return projects;
    return [...projects].sort((a, b) => PROJECT_NAME_COLLATOR.compare(a.title, b.title));
  }, [alphabetical, projects]);

  return (
    <aside className="project-library-backdrop" role="dialog" aria-modal="true" aria-label="项目库">
      <div className="project-library-screen">
        <header className="project-library-header">
          <button type="button" className="project-library-back" onClick={onClose} aria-label="返回主页">
            <span aria-hidden="true">‹</span>
            返回
          </button>
          <h1 className="project-library-title">项目库</h1>
        </header>

        <div className="project-library-body">
          <nav className="project-library-sidebar" aria-label="项目库工具">
            <button type="button" className="is-active" aria-label="显示全部项目" title="显示全部项目">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 5h16l-6.5 7.2V19l-3 1.5v-8.3L4 5Z" />
              </svg>
            </button>
            <button
              type="button"
              className={alphabetical ? "is-active" : ""}
              aria-pressed={alphabetical}
              aria-label={alphabetical ? "恢复后台排序" : "按名称拼音排序"}
              title={alphabetical ? "恢复后台排序" : "按名称拼音排序"}
              onClick={() => setAlphabetical((value) => !value)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M8 4v16M5 7l3-3 3 3M16 20V4M13 17l3 3 3-3" />
              </svg>
            </button>
          </nav>

          <section className="project-library-content">
            {visibleProjects.length > 0 ? (
              <div className="project-library-grid" role="list">
                {visibleProjects.map((project) => (
                  <button
                    key={project.id}
                    type="button"
                    role="listitem"
                    className={`project-library-item${selectedId === project.id ? " is-selected" : ""}`}
                    style={{ "--library-accent": project.accentColor || "#24c9f4" } as CSSProperties}
                    onMouseEnter={() => setSelectedId(project.id)}
                    onMouseLeave={() => setSelectedId(null)}
                    onFocus={() => setSelectedId(project.id)}
                    onBlur={() => setSelectedId(null)}
                    onClick={() => onOpenProject(project)}
                    aria-label={`查看 ${project.title}`}
                  >
                    <span className="project-library-art">
                      {project.iconUrl ? (
                        <img src={project.iconUrl} alt="" draggable="false" />
                      ) : (
                        <span>{project.coverLabel || project.title.charAt(0)}</span>
                      )}
                    </span>
                    <span className="project-library-tooltip" aria-hidden="true">
                      <strong>{project.title}</strong>
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="project-library-empty">
                <span aria-hidden="true">▦</span>
                <strong>项目库还是空的</strong>
                <p>在管理后台新增项目后会显示在这里</p>
              </div>
            )}
          </section>
        </div>
      </div>
    </aside>
  );
}
