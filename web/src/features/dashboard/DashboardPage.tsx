import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";

export function DashboardPage() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;

    api.checkSession().then((s) => {
      if (!cancelled) {
        if (s.authenticated) {
          setChecking(false);
        } else {
          navigate("/", { replace: true });
        }
      }
    }).catch(() => {
      if (!cancelled) navigate("/", { replace: true });
    });

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
