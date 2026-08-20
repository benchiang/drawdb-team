import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// 在 RequireAuth 基础上叠加：必须是 admin
export default function RequireAdmin({ children }) {
  const { status, user } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center text-zinc-500">
        Loading...
      </div>
    );
  }

  if (status !== "authed") {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  if (user?.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-white shadow rounded-md p-8 text-center">
          <div className="text-xl font-bold text-zinc-800 mb-2">403</div>
          <div className="text-zinc-500">仅管理员可访问该页面</div>
        </div>
      </div>
    );
  }

  return children;
}
