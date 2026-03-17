import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

interface User {
  id: string;
  username: string;
  role: string;
}

interface AppState {
  theme: "light" | "dark";
  sidebarCollapsed: boolean;
  token: string | null;
  user: User | null;
  toggleTheme: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setToken: (token: string) => void;
  setUser: (user: User) => void;
  logout: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      theme: "light",
      sidebarCollapsed: false,
      token: null,
      user: null,
      toggleTheme: () =>
        set((state) => ({ theme: state.theme === "light" ? "dark" : "light" })),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      setToken: (token) => set({ token }),
      setUser: (user) => set({ user }),
      logout: () => set({ token: null, user: null }),
    }),
    {
      name: "lingux-app-storage",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

export const selectIsAuthenticated = (state: AppState) => !!state.token;
