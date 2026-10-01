import { useEffect, useState } from "react";

let mermaidLoader: Promise<typeof import("mermaid")["default"]> | undefined;
let nextDiagramId = 0;

function loadMermaid() {
  mermaidLoader ??= import("mermaid").then(({ default: mermaid }) => {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      suppressErrorRendering: true,
      theme: "dark",
      fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
    });
    return mermaid;
  }).catch((error: unknown) => {
    mermaidLoader = undefined;
    throw error;
  });
  return mermaidLoader;
}

interface DiagramResult {
  source: string;
  svg?: string;
  width?: number;
  failed?: boolean;
}

export function MermaidDiagram({ source }: { source: string }) {
  const [result, setResult] = useState<DiagramResult>();

  useEffect(() => {
    let cancelled = false;

    async function render() {
      try {
        const mermaid = await loadMermaid();
        await document.fonts.ready;
        if (cancelled) return;

        // Mermaid queues renders; every invocation needs its own SVG/marker IDs.
        const { svg } = await mermaid.render(`markdown-diagram-${++nextDiagramId}`, source);
        const element = new DOMParser().parseFromString(svg, "image/svg+xml").documentElement;
        const viewBoxWidth = Number(element.getAttribute("viewBox")?.split(/[\s,]+/)[2]);
        if (!cancelled) {
          setResult({ source, svg, width: viewBoxWidth > 0 ? viewBoxWidth : undefined });
        }
      } catch {
        if (!cancelled) setResult({ source, failed: true });
      }
    }

    void render();
    return () => { cancelled = true; };
  }, [source]);

  const current = result?.source === source ? result : undefined;

  if (current?.failed) {
    return (
      <div className="markdown-diagram-error">
        <p role="status">流程图暂时无法渲染，以下为原始 Mermaid 代码。</p>
        <pre><code className="language-mermaid">{source}</code></pre>
      </div>
    );
  }

  return (
    <div className="markdown-diagram" role="region" aria-label="Mermaid 图表" aria-busy={!current?.svg} tabIndex={0}>
      {current?.svg ? (
        <div
          className="markdown-diagram-svg"
          style={{ width: current.width }}
          // Only Mermaid's strict-mode sanitized SVG reaches this container.
          dangerouslySetInnerHTML={{ __html: current.svg }}
        />
      ) : <span role="status">正在绘制流程图…</span>}
    </div>
  );
}
