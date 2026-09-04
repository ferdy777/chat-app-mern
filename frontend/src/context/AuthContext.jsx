import { createContext, useContext, useEffect, useState } from "react";
import api from "../utils/axios";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [authUser, setAuthUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data } = await api.get("/auth/me");
        setAuthUser(data);
      } catch {
        setAuthUser(null);
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  const login = async (emailOrUsername, password) => {
    const { data } = await api.post("/auth/login", { emailOrUsername, password });
    setAuthUser(data);
    return data;
  };

  const register = async (formData) => {
    const { data } = await api.post("/auth/register", formData);
    setAuthUser(data);
    return data;
  };

  const logout = async () => {
    await api.post("/auth/logout");
    setAuthUser(null);
  };

  return (
    <AuthContext.Provider value={{ authUser, setAuthUser, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
