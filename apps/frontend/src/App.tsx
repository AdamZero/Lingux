import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfigProvider, App as AntdApp } from 'antd';
import MainLayout from '@/layout/MainLayout';
import ProjectPage from '@/pages/ProjectPage';

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
  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider>
        <AntdApp>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<MainLayout />}>
                <Route index element={<Navigate to="/projects" replace />} />
                <Route path="projects" element={<ProjectPage />} />
                <Route path="locales" element={<div>Locales Management Page</div>} />
                <Route path="keys" element={<div>Keys Management Page</div>} />
                <Route path="settings" element={<div>Settings Page</div>} />
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
