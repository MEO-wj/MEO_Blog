import type { CSSProperties } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Project } from "../../api/types";
import type { SwitchHomeProject } from "./switchHomeData";
import { useWheelScroll } from "./useWheelScroll";

interface ProjectDetailProps {
  project: Project | SwitchHomeProject;
  onClose: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  ready: "已完成",
  soon: "即将推出",
  external: "外部项目",
  "in-progress": "开发中",
};

function isFullProject(p: Project | SwitchHomeProject): p is Project {
  return "name" in p && "slug" in p;
}

export function ProjectDetail({ project, onClose }: ProjectDetailProps) {
  const accent = project.accentColor || "#24c9f4";
  const scrollRef = useWheelScroll<HTMLDivElement>();

  const name = isFullProject(project) ? project.name : project.title;
  const description = isFullProject(project) ? project.description : project.subtitle;
  const repoUrl = project.repoUrl;
  const demoUrl = isFullProject(project) ? project.demoUrl : undefined;
  const category = project.category;
  const techStack = isFullProject(project) ? project.techStack : undefined;
  const status = project.status;
  const iconUrl = project.iconUrl;

  return (
    <div
      className="project-detail-backdrop"
      style={{ "--detail-accent": accent } as CSSProperties}
      onClick={onClose}
    >
      <div
        className="project-detail-card"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="project-detail-close"
          type="button"
          aria-label="关闭"
          onClick={onClose}
        >
          ×
        </button>

        <div className="project-detail-left">
          {iconUrl ? (
            <img className="project-detail-icon" src={iconUrl} alt={name} />
          ) : (
            <div className="project-detail-icon-fallback" style={{ background: accent }}>
              <span>{name.charAt(0)}</span>
            </div>
          )}
        </div>

        <div ref={scrollRef} className="project-detail-right">
          <div className="project-detail-header">
            <h2 className="project-detail-title">{name}</h2>
            {category && <span className="project-detail-category">{category}</span>}
          </div>

          {techStack && techStack.length > 0 && (
            <div className="project-detail-tech">
              {techStack.map((t) => (
                <img
                  key={t}
                  className="project-detail-tech-icon"
                  src={`/icons/tech-stack/${t}/${t}-original.svg`}
                  alt={t}
                  title={t}
                  loading="lazy"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              ))}
            </div>
          )}

          {description && (
            <>
              <h3 className="project-detail-subtitle">项目简介</h3>
              <hr className="project-detail-divider" />
              <div className="project-detail-desc blog-markdown">
                <Markdown remarkPlugins={[remarkGfm]}>{description}</Markdown>
              </div>
            </>
          )}

          <div className="project-detail-actions">
            {repoUrl && (
              <a
                className="project-detail-btn"
                href={repoUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <svg viewBox="0 0 32 32" width="16" height="16" aria-hidden="true">
                  <path d="M10.5 25.5c-3.5 1.2-3.5-1.5-5-2.5" />
                  <path d="M21.5 29v-4.5c0-1.2.3-2-.6-2.8 3-.4 6.1-1.5 6.1-6.5 0-1.5-.5-2.8-1.4-3.8.1-.4.6-1.9-.1-3.8 0 0-1.2-.4-4 1.4a14 14 0 0 0-7.2 0c-2.8-1.8-4-1.4-4-1.4-.7 1.9-.2 3.4-.1 3.8-.9 1-1.4 2.3-1.4 3.8 0 5 3.1 6.1 6.1 6.5-.5.4-.8 1.1-.9 2.1V29" />
                </svg>
                GitHub 仓库
              </a>
            )}
            {demoUrl && (
              <a
                className="project-detail-btn"
                href={demoUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
                在线预览
              </a>
            )}
          </div>
        </div>

        {status && (
          <div className="project-detail-status">
            <span className="project-detail-status-dot" />
            <span>{STATUS_LABELS[status] || status}</span>
          </div>
        )}
      </div>
    </div>
  );
}
