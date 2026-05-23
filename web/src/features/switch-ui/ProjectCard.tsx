import { memo, type CSSProperties } from "react";
import { Icon, type IconName } from "./Icon";
import type { SwitchHomeProject } from "./switchHomeData";

interface ProjectCardProps {
  project: SwitchHomeProject;
  selected: boolean;
  dragging: boolean;
  onSelect: () => void;
  onDeselect: () => void;
  onOpen: () => void;
  onOpenRepo: () => void;
  onHoverSound?: () => void;
  onClickSound?: () => void;
}

export const ProjectCard = memo(function ProjectCard({
  project,
  selected,
  dragging,
  onSelect,
  onDeselect,
  onOpen,
  onOpenRepo,
  onHoverSound,
  onClickSound,
}: ProjectCardProps) {
  const cardStyle = {
    "--project-accent": project.accentColor,
  } as CSSProperties;

  return (
    <article
      className={`switch-project-card ${selected ? "is-hovered" : ""}`}
      style={cardStyle}
      aria-label={project.title}
      aria-current={selected}
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
      <div className={`switch-project-cover ${project.iconUrl ? "has-custom-icon" : ""}`} data-icon={project.icon ?? "empty"}>
        <span className="switch-project-art" aria-hidden="true">
          {project.iconUrl ? (
            <img src={project.iconUrl} alt="" className="switch-project-custom-icon" draggable="false" />
          ) : (
            <span>{project.coverLabel}</span>
          )}
        </span>
      </div>
      <div className="switch-project-meta">
        <span className="switch-project-title">{project.title}</span>
        <span className="switch-project-subtitle">{project.subtitle}</span>
      </div>
      <button
        className="switch-repo-button"
        type="button"
        aria-label={`${project.title} 仓库`}
        disabled={!project.repoUrl}
        onClick={(event) => {
          event.stopPropagation();
          onSelect();
          onOpenRepo();
        }}
      >
        <Icon name={"github" as IconName} />
      </button>
      {project.status === "soon" && <span className="switch-project-badge">即将推出</span>}
    </article>
  );
});
