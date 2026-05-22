export interface SwitchHomeProject {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  coverLabel: string;
  icon?: "blog" | "scene" | "api" | "lab" | "notes" | "empty";
  iconUrl?: string;
  accentColor: string;
  repoUrl?: string;
  route?: string;
  slug?: string;
  status?: "ready" | "soon" | "external";
}

export interface SwitchHomeAction {
  id: string;
  label: string;
  icon: "favorite" | "github" | "resume" | "blog" | "contact" | "admin" | "power";
  accentColor: string;
}

export const switchHomeUser = {
  name: "MEO",
  email: "无",
};

export const switchHomeProjects: SwitchHomeProject[] = [
  {
    id: "empty-1",
    title: "无",
    subtitle: "",
    category: "",
    coverLabel: "",
    icon: "empty",
    accentColor: "#4a4a4d",
  },
  {
    id: "empty-2",
    title: "无",
    subtitle: "",
    category: "",
    coverLabel: "",
    icon: "empty",
    accentColor: "#4a4a4d",
  },
  {
    id: "empty-3",
    title: "无",
    subtitle: "",
    category: "",
    coverLabel: "",
    icon: "empty",
    accentColor: "#4a4a4d",
  },
  {
    id: "empty-4",
    title: "无",
    subtitle: "",
    category: "",
    coverLabel: "",
    icon: "empty",
    accentColor: "#4a4a4d",
  },
  {
    id: "empty-5",
    title: "无",
    subtitle: "",
    category: "",
    coverLabel: "",
    icon: "empty",
    accentColor: "#4a4a4d",
  },
];

export const switchHomeActions: SwitchHomeAction[] = [
  { id: "favorites", label: "重要收藏", icon: "favorite", accentColor: "#f02d3a" },
  { id: "github-home", label: "Github主页", icon: "github", accentColor: "#f0782d" },
  { id: "resume", label: "我的简历", icon: "resume", accentColor: "#49a8ff" },
  { id: "blog", label: "我的博客", icon: "blog", accentColor: "#2fcf7f" },
  { id: "contact", label: "留言墙", icon: "contact", accentColor: "#21c6c0" },
  { id: "admin", label: "管理后台", icon: "admin", accentColor: "#a9abb8" },
  { id: "power", label: "退出界面", icon: "power", accentColor: "#c5c7d2" },
];
