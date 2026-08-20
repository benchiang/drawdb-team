// 统一的 axios 实例：自动携带 JWT、处理 401 跳登录页
import axios from "axios";

const TOKEN_KEY = "drawdb.token";
const USER_KEY = "drawdb.user";

export const client = axios.create({
  baseURL: "/api",
  timeout: 30000,
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 401) {
      // token 失效：清掉并跳登录
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      if (
        typeof window !== "undefined" &&
        window.location.pathname !== "/login"
      ) {
        const next = encodeURIComponent(
          window.location.pathname + window.location.search,
        );
        window.location.replace(`/login?next=${next}`);
      }
    }
    return Promise.reject(err);
  },
);

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token, user) => {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  clear: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
  user: () => {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },
};

export function getErrorMessage(err, fallback = "Request failed") {
  return (
    err?.response?.data?.error ||
    err?.response?.data?.message ||
    err?.message ||
    fallback
  );
}
