import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfigProvider, App as AntdApp, theme as antdTheme } from 'antd';
import MainLayout from '@/layout/MainLayout';
import ProjectPage from '@/pages/ProjectPage';
import KeysPage from '@/pages/KeysPage';
import LocalesPage from '@/pages/LocalesPage';
import { useAppStore } from '@/store/useAppStore';

// Create a query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const App: React.FC = () => {
  const { theme } = useAppStore();

  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider
        theme={{
          algorithm: theme === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        }}
      >
        <AntdApp>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<MainLayout />}>
                <Route index element={<Navigate to="/projects" replace />} />
                <Route path="projects" element={<ProjectPage />} />
                
                {/* Project Context Routes */}
                <Route path="project/:projectId">
                  <Route index element={<Navigate to="keys" replace />} />
                  <Route path="keys" element={<KeysPage />} />
                  <Route path="locales" element={<LocalesPage />} />
                  <Route path="settings" element={<div>Settings Page</div>} />
                </Route>

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
