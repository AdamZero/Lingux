import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConfigProvider, App as AntdApp, theme as antdTheme, Spin } from "antd";
import MainLayout from "@/layout/MainLayout";
import ProjectPage from "@/pages/ProjectPage";
import KeysPage from "@/pages/KeysPage";
import LoginPage from "@/pages/LoginPage";
import DashboardPage from "@/pages/DashboardPage";
import ReleaseCenter from "@/pages/ReleaseCenter";
import {
  useAppStore,
  selectIsAuthenticated,
  selectHasHydrated,
} from "@/store/useAppStore";
import { usePermission } from "@/hooks/usePermission";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const isAuthenticated = useAppStore(selectIsAuthenticated);
  const hasHydrated = useAppStore(selectHasHydrated);

  // Wait for hydration to complete before making auth decisions
  if (!hasHydrated) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
        }}
      >
        <Spin size="large" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

const RequireRole: React.FC<{ children: React.ReactNode; roles: string[] }> = ({
  children,
  roles,
}) => {
  const { user } = usePermission();
  if (!user || !roles.includes(user.role)) {
    return <Navigate to="/workspace" replace />;
  }
  return <>{children}</>;
};

const App: React.FC = () => {
  const theme = useAppStore((state) => state.theme);

  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider
        theme={{
          algorithm:
            theme === "dark"
              ? antdTheme.darkAlgorithm
              : antdTheme.defaultAlgorithm,
        }}
      >
        <AntdApp>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <MainLayout />
                  </ProtectedRoute>
                }
              >
                {/* 默认跳转工作台 */}
                <Route index element={<Navigate to="/workspace" replace />} />

                {/* 工作台 */}
                <Route path="workspace" element={<DashboardPage />} />

                {/* 项目列表 */}
                <Route path="projects" element={<ProjectPage />} />

                {/* 翻译管理 */}
                <Route path="project/:projectId">
                  <Route index element={<Navigate to="keys" replace />} />
                  <Route path="keys" element={<KeysPage />} />
                  <Route path="settings" element={<div>Settings Page</div>} />
                </Route>

                {/* 审核工作台（预留） */}
                <Route
                  path="reviews"
                  element={
                    <RequireRole roles={["REVIEWER", "ADMIN"]}>
                      <div>Review Dashboard (Coming Soon)</div>
                    </RequireRole>
                  }
                />

                {/* 发布中心 */}
                <Route path="releases" element={<ReleaseCenter />} />

                {/* 404 */}
                <Route path="*" element={<div>404 Not Found</div>} />
              </Route>
            </Routes>
          </BrowserRouter>
        </AntdApp>
      </ConfigProvider>
    </QueryClientProvider>
  );
};

export default App;
