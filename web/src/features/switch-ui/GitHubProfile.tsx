import { useEffect, useState } from "react";
import { api } from "../../api/client";
import type { GHUser, GHRepo } from "../../api/types";
import { useAdminStore } from "../../stores/adminStore";
import { useWheelScroll } from "./useWheelScroll";

interface GitHubProfileProps {
  username: string;
  onClose: () => void;
}

interface ContributionDay {
  date: string;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
}

const CONTRIBUTION_COLORS = ["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"];

export function GitHubProfile({ username, onClose }: GitHubProfileProps) {
  const { profile: adminProfile } = useAdminStore();
  const [user, setUser] = useState<GHUser | null>(null);
  const [repos, setRepos] = useState<GHRepo[]>([]);
  const [contributions, setContributions] = useState<ContributionDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryCount, setRetryCount] = useState(0);
  const scrollRef = useWheelScroll<HTMLDivElement>();

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      setLoading(true);
      setError("");
      try {
        const [ghData, contribData] = await Promise.all([
          api.getGithubUser(username).catch(() => null),
          api.getGithubContributions(username).catch(() => null),
        ]);

        if (cancelled) return;

        if (!ghData) {
          setError("无法获取 GitHub 用户信息");
          setLoading(false);
          return;
        }

        const u = ghData.user;
        // Supplement with admin profile data if GitHub doesn't have it
        if (!u.email && adminProfile?.email) u.email = adminProfile.email;
        if (!u.location && (adminProfile?.province || adminProfile?.city)) {
          u.location = [adminProfile.province, adminProfile.city].filter(Boolean).join(" ");
        }
        if (!u.name && adminProfile?.displayName) u.name = adminProfile.displayName;
        setUser(u);
        setRepos(ghData.repos.filter((r) => !r.name.includes(".github.io")).slice(0, 12));

        if (contribData?.contributions) {
          const days: ContributionDay[] = contribData.contributions.map(
            (c) => ({
              date: c.date,
              count: c.count,
              level: Math.min(c.level, 4) as 0 | 1 | 2 | 3 | 4,
            })
          );
          // Keep only last 90 days (15 cols × 6 rows)
          const last90 = days.slice(-90);
          // Pad to fill complete grid if needed
          const padded = last90.length < 90
            ? [...Array(90 - last90.length).fill({ date: "", count: 0, level: 0 }), ...last90]
            : last90;
          setContributions(padded);
        }
      } catch (e) {
        if (!cancelled) setError(`请求失败: ${e instanceof Error ? e.message : "未知错误"}`);
      }
      if (!cancelled) setLoading(false);
    }

    fetchData();
    return () => { cancelled = true; };
  }, [username, retryCount]);

  function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(diff / 86400000);
    if (days < 1) return "今天";
    if (days < 30) return `${days} 天前`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months} 个月前`;
    return `${Math.floor(months / 12)} 年前`;
  }

  if (loading) {
    return (
      <div className="gh-profile-backdrop" onClick={onClose}>
        <div ref={scrollRef} className="gh-profile-card gh-profile-loading" onClick={(e) => e.stopPropagation()}>
          <div className="gh-loading-spinner" />
          <p className="gh-loading-text">正在获取 GitHub 数据...</p>
        </div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="gh-profile-backdrop" onClick={onClose}>
        <div ref={scrollRef} className="gh-profile-card gh-profile-error" onClick={(e) => e.stopPropagation()}>
          <p>{error || "未找到用户"}</p>
          <div className="gh-profile-error-actions">
            <button type="button" onClick={() => { setError(""); setRetryCount((c) => c + 1); }}>重试</button>
            <button type="button" onClick={onClose}>关闭</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="gh-profile-backdrop" onClick={onClose}>
      <div ref={scrollRef} className="gh-profile-card" onClick={(e) => e.stopPropagation()}>
        <button className="gh-profile-close" type="button" aria-label="关闭" onClick={onClose}>×</button>

        {/* Header: user info + contributions side by side */}
        <div className="gh-profile-header">
          <div className="gh-profile-header-left">
            <img className="gh-profile-avatar" src={user.avatar_url} alt={user.login} />
            <div className="gh-profile-info">
              <h2 className="gh-profile-name">{user.name || user.login}</h2>
              {user.bio && <p className="gh-profile-bio">{user.bio}</p>}
              <div className="gh-profile-meta">
                {user.location && (
                  <span className="gh-profile-meta-item">
                    <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                      <path d="M12.596 11.596l-3.535 3.535a1.5 1.5 0 01-2.122 0l-3.535-3.535a6.5 6.5 0 119.192 0zM8 8.5a2 2 0 100-4 2 2 0 000 4z" />
                    </svg>
                    {user.location}
                  </span>
                )}
                {user.email && (
                  <span className="gh-profile-meta-item">
                    <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                      <path d="M1.75 2h12.5c.966 0 1.75.784 1.75 1.75v8.5A1.75 1.75 0 0114.25 14H1.75A1.75 1.75 0 010 12.25v-8.5C0 2.784.784 2 1.75 2zM1.5 12.251c0 .138.112.25.25.25h12.5a.25.25 0 00.25-.25V5.809L8.38 9.397a.75.75 0 01-.76 0L1.5 5.809v6.442zm13-8.181v-.32a.25.25 0 00-.25-.25H1.75a.25.25 0 00-.25.25v.32L8 7.88l6.5-3.81z" />
                    </svg>
                    {user.email}
                  </span>
                )}
                <span className="gh-profile-meta-item">
                  <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                    <path d="M2 5.5a3.5 3.5 0 115.898 2.549 5.508 5.508 0 013.034 4.084.75.75 0 11-1.482.235 4.001 4.001 0 00-7.9 0 .75.75 0 01-1.482-.236A5.507 5.507 0 013.102 8.05 3.493 3.493 0 012 5.5zM11 4a.75.75 0 100 1.5 1.5 1.5 0 01.666 2.844.75.75 0 00-.416.672v.352a.75.75 0 00.574.73c1.2.289 2.162 1.2 2.522 2.372a.75.75 0 101.434-.44 5.01 5.01 0 00-2.56-3.012A3 3 0 0011 4z" />
                  </svg>
                  {user.followers} 关注者 · {user.following} 关注中
                </span>
              </div>
              <a
                className="gh-profile-link-btn"
                href={user.html_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                  <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
                </svg>
                跳转 GitHub 主页
              </a>
            </div>
          </div>

          {/* Contributions on the right */}
          {contributions.length > 0 && (
            <div className="gh-profile-header-right">
              <h3 className="gh-profile-contrib-title">
                {contributions.reduce((s, d) => s + d.count, 0)} 次提交（近 90 天）
              </h3>
              <div className="gh-profile-contrib">
                <div className="gh-profile-contrib-grid">
                  {contributions.map((day, i) => (
                    <div
                      key={day.date}
                      className={`gh-profile-contrib-cell${day.level > 0 ? " gh-contrib-active" : ""}`}
                      style={{
                        background: CONTRIBUTION_COLORS[day.level],
                        animationDelay: day.level > 0 ? `${(i % 7) * 0.15}s` : undefined,
                      }}
                      title={`${day.date}: ${day.count} 次提交`}
                    />
                  ))}
                </div>
                <div className="gh-profile-contrib-legend">
                  <span>少</span>
                  {CONTRIBUTION_COLORS.map((c, i) => (
                    <div key={i} className="gh-profile-contrib-cell" style={{ background: c }} />
                  ))}
                  <span>多</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Repositories at the bottom */}
        {repos.length > 0 && (
          <div className="gh-profile-section">
            <h3 className="gh-profile-section-title">公开仓库</h3>
            <div className="gh-profile-repos-grid">
              {repos.map((repo) => (
                <a
                  key={repo.id}
                  className="gh-profile-repo-card"
                  href={repo.html_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <div className="gh-profile-repo-name">
                    <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                      <path d="M2 2.5A2.5 2.5 0 014.5 0h8.75a.75.75 0 01.75.75v12.5a.75.75 0 01-.75.75h-2.5a.75.75 0 110-1.5h1.75v-2h-8a1 1 0 00-.714 1.7.75.75 0 01-1.072 1.05A2.495 2.495 0 012 11.5v-9zm10.5-1h-8a1 1 0 00-1 1v6.708A2.486 2.486 0 014.5 9h8V1.5z" />
                    </svg>
                    <span>{repo.name}</span>
                  </div>
                  {repo.description && (
                    <p className="gh-profile-repo-desc">{repo.description}</p>
                  )}
                  <div className="gh-profile-repo-footer">
                    {repo.language && (
                      <span className="gh-profile-repo-lang">
                        <span className="gh-profile-lang-dot" data-lang={repo.language} />
                        {repo.language}
                      </span>
                    )}
                    {repo.stargazers_count > 0 && (
                      <span className="gh-profile-repo-stars">
                        <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor">
                          <path d="M8 .25a.75.75 0 01.673.418l1.882 3.815 4.21.612a.75.75 0 01.416 1.279l-3.046 2.97.719 4.192a.75.75 0 01-1.088.791L8 12.347l-3.766 1.98a.75.75 0 01-1.088-.79l.72-4.194L.818 6.374a.75.75 0 01.416-1.28l4.21-.611L7.327.668A.75.75 0 018 .25z" />
                        </svg>
                        {repo.stargazers_count}
                      </span>
                    )}
                    {repo.forks_count > 0 && (
                      <span className="gh-profile-repo-forks">
                        <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor">
                          <path d="M5 3.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm0 2.122a2.25 2.25 0 10-1.5 0v.878A2.25 2.25 0 005.75 8.5h1.5v2.128a2.251 2.251 0 101.5 0V8.5h1.5a2.25 2.25 0 002.25-2.25v-.878a2.25 2.25 0 10-1.5 0v.878a.75.75 0 01-.75.75h-4.5A.75.75 0 015 6.25v-.878zm3.75 7.378a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm3-8.75a.75.75 0 100-1.5.75.75 0 000 1.5z" />
                        </svg>
                        {repo.forks_count}
                      </span>
                    )}
                    <span className="gh-profile-repo-time">{timeAgo(repo.updated_at)}更新</span>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
