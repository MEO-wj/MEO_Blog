import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./app/Layout";
import { SceneEntry } from "./scene/SceneEntry";
import { DashboardPage } from "./features/dashboard/DashboardPage";
import { PostsPage } from "./features/posts/PostsPage";
import { ProjectsPage } from "./features/projects/ProjectsPage";
import { GamesPage } from "./features/games/GamesPage";
import { AboutPage } from "./features/about/AboutPage";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<SceneEntry />} />
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/posts" element={<PostsPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/games" element={<GamesPage />} />
          <Route path="/about" element={<AboutPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
