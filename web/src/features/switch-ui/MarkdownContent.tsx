import type { ComponentProps } from "react";
import Markdown, { type ExtraProps } from "react-markdown";
import remarkGfm from "remark-gfm";
import { MermaidDiagram } from "./MermaidDiagram";

function MarkdownBlock({ node, children, ...props }: ComponentProps<"pre"> & ExtraProps) {
  const code = node?.children[0];
  if (
    code?.type === "element" &&
    code.tagName === "code" &&
    Array.isArray(code.properties.className) &&
    code.properties.className.some((name) => String(name).toLowerCase() === "language-mermaid")
  ) {
    const source = code.children.map((child) => child.type === "text" ? child.value : "").join("");
    return <MermaidDiagram source={source} />;
  }

  return <pre {...props}>{children}</pre>;
}

const components = { pre: MarkdownBlock };

export default function MarkdownContent({ children }: { children?: string }) {
  return <Markdown remarkPlugins={[remarkGfm]} components={components}>{children}</Markdown>;
}
