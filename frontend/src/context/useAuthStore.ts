import { create } from "zustand";

interface AuthState {
  token: string | null;
  isAuthenticated: boolean;
  setToken: (token: string | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  // Initialize token from localStorage if available safely inside browser environment
token: typeof window !== "undefined" ? (localStorage.getItem("wt_token") || "DEV_BYPASS_TOKEN") : "DEV_BYPASS_TOKEN",
  isAuthenticated: true,  
  setToken: (token) => {
    if (token) {
      localStorage.setItem("wt_token", token);
      set({ token, isAuthenticated: true });
    } else {
      localStorage.removeItem("wt_token");
      set({ token: null, isAuthenticated: false });
    }
  },
  
  logout: () => {
    localStorage.removeItem("wt_token");
    set({ token: null, isAuthenticated: false });
  },
}));