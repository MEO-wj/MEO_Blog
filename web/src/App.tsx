import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./app/Layout";
import { SceneEntry } from "./scene/SceneEntry";

const DashboardPage = lazy(() => import("./features/dashboard/DashboardPage").then(m => ({ default: m.DashboardPage })));
const PostsPage = lazy(() => import("./features/posts/PostsPage").then(m => ({ default: m.PostsPage })));
const ProjectsPage = lazy(() => import("./features/projects/ProjectsPage").then(m => ({ default: m.ProjectsPage })));
const GamesPage = lazy(() => import("./features/games/GamesPage").then(m => ({ default: m.GamesPage })));
const AboutPage = lazy(() => import("./features/about/AboutPage").then(m => ({ default: m.AboutPage })));

function PageLoader() {
  return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#8a9bbd" }}>加载中...</div>;
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<SceneEntry />} />
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
