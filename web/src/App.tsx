import { lazy, Suspense, useEffect, useState } from "react";
import { createBrowserRouter, createRoutesFromElements, RouterProvider, Route, Link, useLocation } from "react-router-dom";
import { Layout } from "./app/Layout";

const SceneEntry = lazy(() => import("./scene/SceneEntry").then(m => ({ default: m.SceneEntry })));
const MobileSwitchAppHome = lazy(() => import("./features/switch-ui/MobileSwitchAppHome").then(m => ({ default: m.MobileSwitchAppHome })));

const DashboardPage = lazy(() => import("./features/dashboard/DashboardPage").then(m => ({ default: m.DashboardPage })));
const GamesPage = lazy(() => import("./features/games/GamesPage").then(m => ({ default: m.GamesPage })));
const AboutPage = lazy(() => import("./features/about/AboutPage").then(m => ({ default: m.AboutPage })));

const MOBILE_HOME_MEDIA = "(max-width: 760px), (pointer: coarse) and (max-width: 1024px)";

function shouldUseMobileHome() {
  return window.matchMedia(MOBILE_HOME_MEDIA).matches;
}

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

function useIsMobileHome(inGame: boolean) {
  const [isMobile, setIsMobile] = useState(shouldUseMobileHome);

  useEffect(() => {
    const media = window.matchMedia(MOBILE_HOME_MEDIA);
    const onChange = () => {
      if (media.matches && !inGame) setIsMobile(true);
    };

    onChange();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [inGame]);

  return isMobile;
}

function HomeEntry() {
  const inGame = useLocation().pathname.startsWith('/games/');
  const isMobile = useIsMobileHome(inGame);

  if (isMobile && inGame) return <div style={{ minHeight: '100dvh', background: '#191b20', color: '#eee', display: 'grid', placeItems: 'center', padding: 24 }}><div>
    <h1>游戏仅在电脑端提供</h1><p>请使用电脑浏览器和键盘打开游戏。</p><Link to="/" style={{ color: '#62d9c8' }}>返回博客主页</Link>
  </div></div>;

  return (
    <Suspense fallback={<RootLoader />}>
      {isMobile ? <MobileSwitchAppHome /> : <SceneEntry />}
    </Suspense>
  );
}

const router = createBrowserRouter(createRoutesFromElements(
      <>
        <Route path="/" element={<HomeEntry />} />
        <Route path="/github" element={<HomeEntry />} />
        <Route path="/blog" element={<HomeEntry />} />
        <Route path="/posts" element={<HomeEntry />} />
        <Route path="/posts/:postId" element={<HomeEntry />} />
        <Route path="/guestbook" element={<HomeEntry />} />
        <Route path="/resume" element={<HomeEntry />} />
        <Route path="/favorites" element={<HomeEntry />} />
        <Route path="/admin" element={<HomeEntry />} />
        <Route path="/projects" element={<HomeEntry />} />
        <Route path="/projects/:projectId" element={<HomeEntry />} />
        <Route path="/games/:gameId" element={<HomeEntry />} />
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<Suspense fallback={<PageLoader />}><DashboardPage /></Suspense>} />
          <Route path="/games" element={<Suspense fallback={<PageLoader />}><GamesPage /></Suspense>} />
          <Route path="/about" element={<Suspense fallback={<PageLoader />}><AboutPage /></Suspense>} />
        </Route>
      </>
));

export function App() { return <RouterProvider router={router} />; }
