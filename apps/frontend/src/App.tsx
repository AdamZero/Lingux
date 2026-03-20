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
import MachineTranslationSettingsPage from "@/pages/MachineTranslationSettingsPage";
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

// 自定义主题配置
const getCustomTheme = (isDark: boolean) => ({
  algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
  token: {
    // 主色调 - Indigo
    colorPrimary: "#4F46E5",
    colorPrimaryHover: "#4338CA",
    colorPrimaryActive: "#3730A3",
    colorPrimaryBg: isDark ? "#312E81" : "#EEF2FF",

    // 功能色
    colorSuccess: "#10B981",
    colorWarning: "#F59E0B",
    colorError: "#EF4444",
    colorInfo: "#3B82F6",

    // 圆角
    borderRadius: 6,
    borderRadiusSM: 4,
    borderRadiusLG: 8,
    borderRadiusXS: 2,

    // 字体
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Helvetica Neue', Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol'",

    // 间距
    paddingXS: 8,
    paddingSM: 12,
    padding: 16,
    paddingMD: 20,
    paddingLG: 24,
    paddingXL: 32,

    // 控制组件尺寸
    controlHeight: 36,
    controlHeightSM: 28,
    controlHeightLG: 44,
  },
  components: {
    Card: {
      borderRadius: 8,
      paddingLG: 24,
    },
    Button: {
      borderRadius: 6,
      paddingInline: 16,
    },
    Input: {
      borderRadius: 6,
      paddingInline: 12,
    },
    Table: {
      borderRadius: 8,
      headerBorderRadius: 8,
    },
    Menu: {
      borderRadius: 6,
      itemBorderRadius: 6,
    },
    Tag: {
      borderRadius: 4,
    },
    Badge: {
      borderRadius: 10,
    },
  },
});

const App: React.FC = () => {
  const theme = useAppStore((state) => state.theme);

  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider theme={getCustomTheme(theme === "dark")}>
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
                </Route>

                {/* 配置中心 */}
                <Route path="settings" element={<div>Settings</div>} />

                {/* 机器翻译设置 */}
                <Route
                  path="machine-translation"
                  element={<MachineTranslationSettingsPage />}
                />

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
