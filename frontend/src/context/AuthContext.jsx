import { createContext, useContext, useEffect, useRef, useState } from "react";
import api from "../utils/axios";

const AuthContext = createContext(null);

// Don't hammer /auth/me every time the tab regains focus — only re-check if
// it's been a little while since the last check.
const REVALIDATE_MIN_INTERVAL_MS = 15000;

export const AuthProvider = ({ children }) => {
  const [authUser, setAuthUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const lastCheckedAt = useRef(0);

  const checkAuth = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const { data } = await api.get("/auth/me");
      setAuthUser(data);
    } catch {
      setAuthUser(null);
    } finally {
      lastCheckedAt.current = Date.now();
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();

    // The axios interceptor fires this the moment ANY request comes back
    // 401 — e.g. the cookie expired while the tab was backgrounded on
    // mobile. Without this, authUser stays stale/truthy and the app sits
    // in a broken "looks logged in, nothing loads" state instead of
    // cleanly dropping to the login screen.
    const handleSessionExpired = () => {
      setAuthUser(null);
    };
    window.addEventListener("auth:session-expired", handleSessionExpired);

    // Re-verify the session whenever the tab comes back to the foreground.
    // Mobile browsers can silently drop/expire the cookie while a tab is
    // backgrounded; without this, you only find out something's wrong when
    // the next API call fails, which is exactly the "resets to a broken
    // state" symptom. `silent: true` avoids flashing the loading screen for
    // what's usually a no-op check.
    const handleVisibility = () => {
      if (
        document.visibilityState === "visible" &&
        Date.now() - lastCheckedAt.current > REVALIDATE_MIN_INTERVAL_MS
      ) {
        checkAuth({ silent: true });
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleVisibility);

    return () => {
      window.removeEventListener("auth:session-expired", handleSessionExpired);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleVisibility);
    };
  }, []);

  const login = async (emailOrUsername, password) => {
    const { data } = await api.post("/auth/login", { emailOrUsername, password });
    lastCheckedAt.current = Date.now();
    setAuthUser(data);
    return data;
  };

  const register = async (formData) => {
    const { data } = await api.post("/auth/register", formData);
    lastCheckedAt.current = Date.now();
    setAuthUser(data);
    return data;
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } finally {
      setAuthUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ authUser, setAuthUser, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);