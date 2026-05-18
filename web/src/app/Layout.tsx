import { Outlet, Link, useLocation } from "react-router-dom";

const navItems = [
  { path: "/dashboard", label: "Home" },
  { path: "/posts", label: "Posts" },
  { path: "/games", label: "Games" },
  { path: "/projects", label: "Projects" },
  { path: "/about", label: "About" },
];

export function Layout() {
  const location = useLocation();

  return (
    <div className="flex flex-col h-full">
      <nav className="flex items-center gap-1 px-4 py-2 border-b border-white/10 bg-surface-light/80 backdrop-blur-sm">
        <Link to="/" className="text-primary font-bold text-sm mr-4">
          MEO
        </Link>
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              location.pathname === item.path
                ? "bg-primary/20 text-primary"
                : "text-text-dim hover:text-text hover:bg-white/5"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
