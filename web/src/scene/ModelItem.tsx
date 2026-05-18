import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { useLoader } from "@react-three/fiber";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { LayoutItem } from "./types";
import { resolveAssetPath, getCachedModelUrl } from "./modelUtils";

export function ModelItem({ item }: { item: LayoutItem }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const assetPath = resolveAssetPath(item);
    let revoked = false;
    let blobUrl: string | undefined;

    getCachedModelUrl(assetPath).then((resolvedUrl) => {
      if (!revoked) {
        blobUrl = resolvedUrl;
        setUrl(resolvedUrl);
      }
    });

    return () => {
      revoked = true;
      if (blobUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [item.id, item.path]);

  if (!url) return null;

  return <LoadedModel url={url} />;
}

function LoadedModel({ url }: { url: string }) {
  const gltf = useLoader(GLTFLoader, url);
  const modelRef = useRef<THREE.Group>(null);

  useEffect(() => {
    if (!modelRef.current) return;

    const model = modelRef.current;
    model.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    model.position.x -= center.x;
    model.position.y -= center.y;
    model.position.z -= center.z;

    model.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
        const mesh = obj as THREE.Mesh;
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const mat of materials) {
          if ("envMapIntensity" in mat) {
            (mat as THREE.MeshStandardMaterial).envMapIntensity =
              mat.name?.includes("Dark") ? 0.55 : 0.72;
          }
        }
      }
    });
  }, [gltf]);

  return (
    <group ref={modelRef}>
      <primitive object={gltf.scene} />
    </group>
  );
}
