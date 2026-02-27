import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import api from "../services/api";
import { User } from "../types";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<AuthResult>;
  register: (data: RegisterData) => Promise<AuthResult>;
  logout: () => Promise<void>;
  updateUser: (user: Partial<User>) => void;
  refreshAuth: () => Promise<boolean>;
}

interface AuthResult {
  success: boolean;
  error?: string;
}

interface RegisterData {
  fullName: string;
  email: string;
  password: string;
  businessName?: string;
}

interface AuthResponse {
  user: User;
  token: string;
  refreshToken: string;
}

interface AuthProviderProps {
  children: ReactNode;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({
  children,
}: AuthProviderProps): React.JSX.Element {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check for existing auth on mount
  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem("token");
      if (token) {
        try {
          api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
          const response = await api.get<{ user: User }>("/auth/me");
          setUser(response.data.user);
          setIsAuthenticated(true);
        } catch (error) {
          console.error("Auth init error:", error);
          localStorage.removeItem("token");
          localStorage.removeItem("refreshToken");
          delete api.defaults.headers.common["Authorization"];
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const login = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      try {
        const response = await api.post<AuthResponse>("/auth/login", {
          email,
          password,
        });
        const { user, token, refreshToken } = response.data;

        localStorage.setItem("token", token);
        localStorage.setItem("refreshToken", refreshToken);
        api.defaults.headers.common["Authorization"] = `Bearer ${token}`;

        setUser(user);
        setIsAuthenticated(true);

        return { success: true };
      } catch (error: unknown) {
        const axiosError = error as {
          response?: { data?: { message?: string } };
        };
        const message = axiosError.response?.data?.message || "Login failed";
        return { success: false, error: message };
      }
    },
    [],
  );

  const register = useCallback(
    async (data: RegisterData): Promise<AuthResult> => {
      try {
        const response = await api.post<AuthResponse>("/auth/register", data);
        const { user, token, refreshToken } = response.data;

        localStorage.setItem("token", token);
        localStorage.setItem("refreshToken", refreshToken);
        api.defaults.headers.common["Authorization"] = `Bearer ${token}`;

        setUser(user);
        setIsAuthenticated(true);

        return { success: true };
      } catch (error: unknown) {
        const axiosError = error as {
          response?: { data?: { message?: string } };
        };
        const message =
          axiosError.response?.data?.message || "Registration failed";
        return { success: false, error: message };
      }
    },
    [],
  );

  const logout = useCallback(async (): Promise<void> => {
    try {
      await api.post("/auth/logout");
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      localStorage.removeItem("token");
      localStorage.removeItem("refreshToken");
      delete api.defaults.headers.common["Authorization"];
      setUser(null);
      setIsAuthenticated(false);
    }
  }, []);

  const updateUser = useCallback((updatedUser: Partial<User>): void => {
    setUser((prev) => (prev ? { ...prev, ...updatedUser } : null));
  }, []);

  const refreshAuth = useCallback(async (): Promise<boolean> => {
    const refreshToken = localStorage.getItem("refreshToken");
    if (!refreshToken) {
      await logout();
      return false;
    }

    try {
      const response = await api.post<AuthResponse>("/auth/refresh", {
        refreshToken,
      });
      const { user, token, refreshToken: newRefreshToken } = response.data;

      localStorage.setItem("token", token);
      localStorage.setItem("refreshToken", newRefreshToken);
      api.defaults.headers.common["Authorization"] = `Bearer ${token}`;

      setUser(user);
      setIsAuthenticated(true);

      return true;
    } catch (error) {
      console.error("Token refresh error:", error);
      await logout();
      return false;
    }
  }, [logout]);

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated,
    login,
    register,
    logout,
    updateUser,
    refreshAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export default AuthContext;
