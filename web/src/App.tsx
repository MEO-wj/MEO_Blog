import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./app/Layout";

const SceneEntry = lazy(() => import("./scene/SceneEntry").then(m => ({ default: m.SceneEntry })));

const DashboardPage = lazy(() => import("./features/dashboard/DashboardPage").then(m => ({ default: m.DashboardPage })));
const PostsPage = lazy(() => import("./features/posts/PostsPage").then(m => ({ default: m.PostsPage })));
const ProjectsPage = lazy(() => import("./features/projects/ProjectsPage").then(m => ({ default: m.ProjectsPage })));
const GamesPage = lazy(() => import("./features/games/GamesPage").then(m => ({ default: m.GamesPage })));
const AboutPage = lazy(() => import("./features/about/AboutPage").then(m => ({ default: m.AboutPage })));

function PageLoader() {
  return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#8a9bbd" }}>加载中...</div>;
}

function RootLoader() {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "grid",
        placeItems: "center",
        background: "#05070d",
        color: "#d8e4ff",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
      }}
    >
      <div style={{ display: "grid", gap: 12, justifyItems: "center" }}>
        <strong style={{ color: "#63e6be", letterSpacing: 4 }}>MEO_Blog</strong>
        <span style={{ color: "#8a9bbd", fontSize: 12 }}>Loading scene...</span>
      </div>
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Suspense fallback={<RootLoader />}><SceneEntry /></Suspense>} />
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<Suspense fallback={<PageLoader />}><DashboardPage /></Suspense>} />
          <Route path="/posts" element={<Suspense fallback={<PageLoader />}><PostsPage /></Suspense>} />
          <Route path="/projects" element={<Suspense fallback={<PageLoader />}><ProjectsPage /></Suspense>} />
          <Route path="/games" element={<Suspense fallback={<PageLoader />}><GamesPage /></Suspense>} />
          <Route path="/about" element={<Suspense fallback={<PageLoader />}><AboutPage /></Suspense>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
