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
  _hasHydrated: boolean;
  toggleTheme: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setToken: (token: string) => void;
  setUser: (user: User) => void;
  logout: () => void;
  setHasHydrated: (hasHydrated: boolean) => void;
}

// 同步主题到 document 的 data-theme 属性
const syncThemeToDocument = (theme: "light" | "dark") => {
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("data-theme", theme);
  }
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      theme: "light",
      sidebarCollapsed: false,
      token: null,
      user: null,
      _hasHydrated: false,
      toggleTheme: () =>
        set((state) => {
          const newTheme = state.theme === "light" ? "dark" : "light";
          syncThemeToDocument(newTheme);
          return { theme: newTheme };
        }),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      setToken: (token) => set({ token }),
      setUser: (user) => set({ user }),
      logout: () => set({ token: null, user: null }),
      setHasHydrated: (state) => set({ _hasHydrated: state }),
    }),
    {
      name: "lingux-app-storage",
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
        // 恢复时同步主题
        if (state?.theme) {
          syncThemeToDocument(state.theme);
        }
      },
    },
  ),
);

export const selectIsAuthenticated = (state: AppState) => !!state.token;
export const selectHasHydrated = (state: AppState) => state._hasHydrated;
