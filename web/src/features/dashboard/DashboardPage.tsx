import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export function DashboardPage() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function verifyAdminSession() {
      try {
        const response = await fetch("/api/v1/admin/session", {
          credentials: "include",
        });

        if (!response.ok) {
          navigate("/", { replace: true });
          return;
        }

        if (!cancelled) {
          setChecking(false);
        }
      } catch {
        navigate("/", { replace: true });
      }
    }

    verifyAdminSession();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  if (checking) {
    return (
      <div className="flex items-center justify-center h-full">
        <h1 className="text-2xl text-text-dim">正在验证管理员会话...</h1>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-full">
      <h1 className="text-2xl text-text-dim">管理后台 - 敬请期待</h1>
    </div>
  );
}
