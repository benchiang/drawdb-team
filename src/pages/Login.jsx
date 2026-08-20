import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { authApi } from "../api/auth";
import logo from "../assets/logo_light_160.png";

export default function Login() {
  const { login, bootstrap, status } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState("loading"); // loading | bootstrap | login
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    authApi
      .bootstrapStatus()
      .then((res) => {
        if (cancelled) return;
        setMode(res.initialized ? "login" : "bootstrap");
      })
      .catch((err) => {
        if (cancelled) return;
        setError(`无法连接后端：${err?.message || "未知错误"}`);
        setMode("login");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 已登录用户访问 /login：跳到首页（Dashboard），忽略 next
  useEffect(() => {
    if (status === "authed") {
      navigate("/", { replace: true });
    }
  }, [status, navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError("");
    const res = await login(username.trim(), password);
    setSubmitting(false);
    if (!res.ok) {
      setError(
        res.error === "invalid_credentials"
          ? "用户名或密码错误"
          : `登录失败：${res.error}`,
      );
      return;
    }
    // 登录成功后无条件跳 Dashboard（忽略 next，避免深链残留跳到陌生图）
    navigate("/", { replace: true });
  };

  const handleBootstrap = async (e) => {
    e.preventDefault();
    if (submitting) return;
    if (password !== confirmPassword) {
      setError("两次输入的密码不一致");
      return;
    }
    if (username.length < 3 || password.length < 4) {
      setError("用户名至少 3 个字符，密码至少 4 个字符");
      return;
    }
    setSubmitting(true);
    setError("");
    const res = await bootstrap(username.trim(), password);
    setSubmitting(false);
    if (!res.ok) {
      setError(
        res.error === "credentials_too_weak"
          ? "用户名/密码过短"
          : `创建失败：${res.error}`,
      );
      return;
    }
    navigate("/", { replace: true });
  };

  if (status === "loading" || mode === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center text-zinc-500">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-100 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
        <div className="flex flex-col items-center mb-6">
          <img src={logo} alt="drawDB" className="h-14 mb-3" />
          <h1 className="text-2xl font-bold text-zinc-800">
            {mode === "bootstrap" ? "初始化管理员" : "drawDB 登录"}
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            {mode === "bootstrap"
              ? "首次启动，请创建管理员账号"
              : "使用本地账号进入数据库设计器"}
          </p>
        </div>

        <form
          onSubmit={mode === "bootstrap" ? handleBootstrap : handleLogin}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              用户名
            </label>
            <input
              autoFocus
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500"
              placeholder="admin"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              密码
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500"
              placeholder="••••••"
              required
            />
          </div>
          {mode === "bootstrap" && (
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                确认密码
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500"
                placeholder="••••••"
                required
              />
            </div>
          )}

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 rounded-md bg-sky-900 hover:bg-sky-800 text-white font-semibold transition-colors disabled:opacity-60"
          >
            {submitting
              ? mode === "bootstrap"
                ? "创建中..."
                : "登录中..."
              : mode === "bootstrap"
                ? "创建管理员账号"
                : "登录"}
          </button>
        </form>

        <div className="mt-6 text-xs text-zinc-400 text-center">
          数据持久化到本地 SQLite（多用户隔离，按 owner 区分）
        </div>
      </div>
    </div>
  );
}
