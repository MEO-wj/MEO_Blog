import { useMemo } from "react";
import type { SceneLayout, LayoutItem } from "./types";
import { ModelItem } from "./ModelItem";

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

interface LayoutItemGroupProps {
  item: LayoutItem;
  childrenOf: Map<string, LayoutItem[]>;
}

function LayoutItemGroup({ item, childrenOf }: LayoutItemGroupProps) {
  const children = childrenOf.get(item.id) ?? [];

  return (
    <group
      position={[item.position.x, item.position.y, item.position.z]}
      rotation={[degToRad(item.rotationDeg.x), degToRad(item.rotationDeg.y), degToRad(item.rotationDeg.z)]}
      scale={[item.scale.x, item.scale.y, item.scale.z]}
    >
      <ModelItem item={item} />
      {children.map((child) => (
        <LayoutItemGroup key={child.id} item={child} childrenOf={childrenOf} />
      ))}
    </group>
  );
}

export function SceneLoader({ layout }: { layout: SceneLayout }) {
  const { roots, childrenOf } = useMemo(() => {
    const childrenMap = new Map<string, LayoutItem[]>();
    const rootItems: LayoutItem[] = [];

    for (const item of layout.items) {
      if (item.parentId) {
        const siblings = childrenMap.get(item.parentId) ?? [];
        siblings.push(item);
        childrenMap.set(item.parentId, siblings);
      } else {
        rootItems.push(item);
      }
    }

    return { roots: rootItems, childrenOf: childrenMap };
  }, [layout.items]);

  return (
    <>
      {roots.map((item) => (
        <LayoutItemGroup key={item.id} item={item} childrenOf={childrenOf} />
      ))}
    </>
  );
}
