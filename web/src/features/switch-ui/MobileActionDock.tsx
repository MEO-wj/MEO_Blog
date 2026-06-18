import { memo, type CSSProperties } from "react";
import { Icon, type IconName } from "./Icon";
import type { SwitchHomeAction } from "./switchHomeData";

interface MobileActionDockProps {
  actions: SwitchHomeAction[];
  labels: Record<string, string>;
  onActivate: (actionId: string) => void;
}

export const MobileActionDock = memo(function MobileActionDock({
  actions,
  labels,
  onActivate,
}: MobileActionDockProps) {
  return (
    <nav className="mobile-bottom-dock" aria-label="Mobile quick actions">
      {actions.map((action) => {
        const style = {
          "--mobile-action-accent": action.accentColor,
        } as CSSProperties;

        return (
          <button
            key={action.id}
            className="mobile-dock-button"
            style={style}
            type="button"
            aria-label={labels[action.id] ?? action.label}
            onClick={() => onActivate(action.id)}
          >
            <Icon name={action.icon as IconName} />
          </button>
        );
      })}
    </nav>
  );
});
