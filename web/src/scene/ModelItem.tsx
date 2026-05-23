import { Component, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { useLoader } from "@react-three/fiber";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "meshoptimizer";
import type { LayoutItem } from "./types";
import { resolveAssetPath, getCachedModelUrl, evictCachedModel } from "./modelUtils";
import { useSceneStore } from "../stores/sceneStore";

const MAX_MODEL_FETCH_ATTEMPTS = 2;
const MAX_MODEL_PARSE_ATTEMPTS = 2;

function configureLoader(loader: GLTFLoader) {
  loader.setMeshoptDecoder(MeshoptDecoder);
}

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

export function ModelItem({ item }: { item: LayoutItem }) {
  const [url, setUrl] = useState<string | null>(null);
  const [fetchNonce, setFetchNonce] = useState(0);
  const registerModel = useSceneStore((s) => s.registerModel);
  const modelLoaded = useSceneStore((s) => s.modelLoaded);
  const modelFailed = useSceneStore((s) => s.modelFailed);
  const modelSkipped = useSceneStore((s) => s.modelSkipped);
  const clearModelFailure = useSceneStore((s) => s.clearModelFailure);
  const registered = useRef(false);
  const loaded = useRef(false);
  const parseAttempts = useRef(0);

  useEffect(() => {
    if (!registered.current) {
      registered.current = true;
      registerModel(item.id);
    }
  }, [item.id, registerModel]);

  useEffect(() => {
    const assetPath = resolveAssetPath(item);
    let cancelled = false;
    let blobUrl: string | undefined;

    (async () => {
      let attempt = 0;

      while (!cancelled && attempt < MAX_MODEL_FETCH_ATTEMPTS) {
        try {
          const resolvedUrl = await getCachedModelUrl(assetPath, {
            forceRefresh: fetchNonce > 0 || attempt > 0,
          });
          if (cancelled) {
            if (resolvedUrl.startsWith("blob:")) URL.revokeObjectURL(resolvedUrl);
            return;
          }

          blobUrl = resolvedUrl;
          clearModelFailure(item.id);
          setUrl(resolvedUrl);
          return;
        } catch (err) {
          if (cancelled) return;
          const message = err instanceof Error ? err.message : "model download failed";
          attempt++;
          if (attempt >= MAX_MODEL_FETCH_ATTEMPTS) {
            modelSkipped(item.id, `${item.label || item.id}: ${message}`);
            return;
          }
          modelFailed(item.id, `${item.label || item.id}: ${message}`);
          const wait = Math.min(1500 * 2 ** attempt, 30000);
          await new Promise((r) => setTimeout(r, wait));
        }
      }
    })();

    return () => {
      cancelled = true;
      if (blobUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [item, item.id, item.path, fetchNonce, clearModelFailure, modelFailed, modelSkipped]);

  const handleModelLoaded = () => {
    if (!loaded.current) {
      loaded.current = true;
      parseAttempts.current = 0;
      clearModelFailure(item.id);
      modelLoaded(item.id);
    }
  };

  const handleGltfError = async () => {
    if (loaded.current) return;
    const assetPath = resolveAssetPath(item);
    parseAttempts.current++;
    if (parseAttempts.current >= MAX_MODEL_PARSE_ATTEMPTS) {
      modelSkipped(item.id, `${item.label || item.id}: model parse failed`);
      return;
    }
    modelFailed(item.id, `${item.label || item.id}: model parse failed, retrying`);
    await evictCachedModel(assetPath).catch(() => {});
    setUrl(null);
    setFetchNonce((value) => value + 1);
  };

  if (!url) return null;

  return (
    <ModelErrorBoundary key={`${item.id}-${fetchNonce}`} onError={handleGltfError}>
      <LoadedModel url={url} onLoaded={handleModelLoaded} />
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
