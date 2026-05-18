export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface LayoutCamera {
  position: Vec3;
  target: Vec3;
}

export interface LayoutItem {
  id: string;
  assetKey: string;
  label: string;
  path: string;
  parentId: string | null;
  position: Vec3;
  rotationDeg: Vec3;
  scale: Vec3;
}

export interface SceneLayout {
  version: number;
  generatedAt: string;
  source: string;
  camera: LayoutCamera;
  items: LayoutItem[];
}
