import { Component, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { useLoader } from "@react-three/fiber";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "meshoptimizer";
import type { LayoutItem } from "./types";
import { resolveAssetPath, getCachedModelUrl } from "./modelUtils";
import { useSceneStore } from "../stores/sceneStore";

function configureLoader(loader: GLTFLoader) {
  loader.setMeshoptDecoder(MeshoptDecoder);
}

// --- Error boundary for GLTF parsing failures ---

interface EBState {
  hasError: boolean;
}

class ModelErrorBoundary extends Component<
  { children: React.ReactNode; onError: () => void },
  EBState
> {
  state: EBState = { hasError: false };

  static getDerivedStateFromError(): EBState {
    return { hasError: true };
  }

  componentDidCatch() {
    this.props.onError();
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

// --- Main component ---

export function ModelItem({ item }: { item: LayoutItem }) {
  const [url, setUrl] = useState<string | null>(null);
  const [gltfRetryKey, setGltfRetryKey] = useState(0);
  const [dead, setDead] = useState(false);
  const registerModel = useSceneStore((s) => s.registerModel);
  const modelLoaded = useSceneStore((s) => s.modelLoaded);
  const registered = useRef(false);
  const loaded = useRef(false);

  // Register exactly once
  useEffect(() => {
    if (!registered.current) {
      registered.current = true;
      registerModel();
    }
  }, [registerModel]);

  // Fetch with retry — do NOT call modelLoaded() on failure
  useEffect(() => {
    if (dead) return;
    const assetPath = resolveAssetPath(item);
    let revoked = false;
    let blobUrl: string | undefined;

    (async () => {
      const maxRetries = 5;
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          const resolvedUrl = await getCachedModelUrl(assetPath);
          if (!revoked) {
            blobUrl = resolvedUrl;
            setUrl(resolvedUrl);
          }
          return; // success
        } catch {
          if (revoked) return;
          if (attempt < maxRetries - 1) {
            // Exponential backoff: 1s, 2s, 4s, 8s
            await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
          }
        }
      }
      // All retries exhausted — mark as loaded so overlay doesn't get stuck
      // but set dead=true so we don't keep retrying
      if (!revoked && !loaded.current) {
        loaded.current = true;
        setDead(true);
        modelLoaded();
      }
    })();

    return () => {
      revoked = true;
      if (blobUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [item.id, item.path, modelLoaded, dead]);

  // Called when GLTF parsing succeeds
  const handleModelLoaded = () => {
    if (!loaded.current) {
      loaded.current = true;
      modelLoaded();
    }
  };

  // Called when GLTF parsing fails — retry by bumping key + cache-busting URL
  const handleGltfError = () => {
    if (gltfRetryKey < 3) {
      setGltfRetryKey((k) => k + 1);
    } else if (!loaded.current) {
      loaded.current = true;
      setDead(true);
      modelLoaded();
    }
  };

  if (!url || dead) return null;

  // Append cache-busting param on retry so useLoader doesn't return stale cached result
  const retryUrl = gltfRetryKey > 0 ? `${url}#retry=${gltfRetryKey}` : url;

  return (
    <ModelErrorBoundary key={gltfRetryKey} onError={handleGltfError}>
      <LoadedModel url={retryUrl} onLoaded={handleModelLoaded} />
    </ModelErrorBoundary>
  );
}

function LoadedModel({ url, onLoaded }: { url: string; onLoaded: () => void }) {
  const gltf = useLoader(GLTFLoader, url, configureLoader);
  const modelRef = useRef<THREE.Group>(null);
  const reported = useRef(false);

  useEffect(() => {
    if (!modelRef.current) return;

    const model = modelRef.current;
    model.updateMatrixWorld(true);

    model.position.set(0, 0, 0);
    model.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    model.parent?.worldToLocal(center);
    model.position.sub(center);

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

    if (!reported.current) {
      reported.current = true;
      onLoaded();
    }
  }, [gltf, onLoaded]);

  return (
    <group ref={modelRef}>
      <primitive object={gltf.scene} />
    </group>
  );
}
