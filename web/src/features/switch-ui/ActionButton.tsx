import { memo, type CSSProperties } from "react";
import { Icon, type IconName } from "./Icon";
import type { SwitchHomeAction } from "./switchHomeData";

interface ActionButtonProps {
  action: SwitchHomeAction;
  selected: boolean;
  focused: boolean;
  onSelect: () => void;
  onDeselect: () => void;
  onActivate: () => void;
  onHoverSound?: () => void;
}

export const ActionButton = memo(function ActionButton({
  action,
  selected,
  focused,
  onSelect,
  onDeselect,
  onActivate,
  onHoverSound,
}: ActionButtonProps) {
  const style = {
    "--action-accent": action.accentColor,
  } as CSSProperties;

  return (
    <button
      className={`switch-action-button ${selected ? "is-hovered" : ""}`}
      style={style}
      type="button"
      aria-label={action.label}
      data-action-label={action.label}
      onMouseEnter={() => {
        if (focused) {
          onSelect();
          onHoverSound?.();
        }
      }}
      onMouseLeave={() => {
        if (focused) onDeselect();
      }}
      onClick={onActivate}
    >
      <Icon name={action.icon as IconName} />
    </button>
  );
});
