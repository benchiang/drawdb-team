import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { client, tokenStore, getErrorMessage } from "../api/client";

const AuthContext = createContext({
  user: null,
  status: "loading", // loading | authed | guest
  login: async () => {},
  bootstrap: async () => {},
  logout: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export default function AuthContextProvider({ children }) {
  const [user, setUser] = useState(() => tokenStore.user());
  const [status, setStatus] = useState(() =>
    tokenStore.get() ? "authed" : "guest",
  );

  useEffect(() => {
    let cancelled = false;
    const token = tokenStore.get();
    if (!token) {
      setStatus("guest");
      return () => {};
    }
    client
      .get("/auth/me")
      .then((res) => {
        if (cancelled) return;
        tokenStore.set(token, res.data.user);
        setUser(res.data.user);
        setStatus("authed");
      })
      .catch(() => {
        if (cancelled) return;
        tokenStore.clear();
        setUser(null);
        setStatus("guest");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (username, password) => {
    try {
      const res = await client.post("/auth/login", { username, password });
      const { token, user: u } = res.data;
      tokenStore.set(token, u);
      setUser(u);
      setStatus("authed");
      return { ok: true };
    } catch (err) {
      return { ok: false, error: getErrorMessage(err, "login_failed") };
    }
  }, []);

  const bootstrap = useCallback(async (username, password) => {
    try {
      const res = await client.post("/auth/bootstrap", { username, password });
      const { token, user: u } = res.data;
      tokenStore.set(token, u);
      setUser(u);
      setStatus("authed");
      return { ok: true };
    } catch (err) {
      return { ok: false, error: getErrorMessage(err, "bootstrap_failed") };
    }
  }, []);

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
    setStatus("guest");
  }, []);

  const value = useMemo(
    () => ({ user, status, login, logout, bootstrap }),
    [user, status, login, logout, bootstrap],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
