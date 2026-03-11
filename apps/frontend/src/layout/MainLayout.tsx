import React, { useMemo } from 'react';
import { Layout, Menu, theme, Button, Breadcrumb } from 'antd';
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  ProjectOutlined,
  GlobalOutlined,
  KeyOutlined,
  SettingOutlined,
  ArrowLeftOutlined,
  SunOutlined,
  MoonOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation, useParams } from 'react-router-dom';
import { useAppStore } from '@/store/useAppStore';

const { Header, Sider, Content } = Layout;

const MainLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { projectId } = useParams();
  const { sidebarCollapsed, setSidebarCollapsed, theme: appTheme, toggleTheme } = useAppStore();
  const {
    token: { colorBgContainer, borderRadiusLG, colorBgLayout },
  } = theme.useToken();

  const menuItems = useMemo(() => {
    if (projectId) {
      return [
        {
          key: 'back',
          icon: <ArrowLeftOutlined />,
          label: 'Back to Projects',
          onClick: () => navigate('/projects'),
        },
        {
          type: 'divider',
        },
        {
          key: `/project/${projectId}/keys`,
          icon: <KeyOutlined />,
          label: 'Keys',
        },
        {
          key: `/project/${projectId}/locales`,
          icon: <GlobalOutlined />,
          label: 'Locales',
        },
        {
          key: `/project/${projectId}/settings`,
          icon: <SettingOutlined />,
          label: 'Settings',
        },
      ];
    }

    return [
      {
        key: '/projects',
        icon: <ProjectOutlined />,
        label: 'Projects',
      },
    ];
  }, [projectId, navigate]);

  return (
    <Layout style={{ minHeight: '100vh', background: colorBgLayout }}>
      <Sider trigger={null} collapsible collapsed={sidebarCollapsed} theme={appTheme}>
        <div
          onClick={() => navigate('/projects')}
          style={{
            height: 48,
            margin: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
            paddingInline: sidebarCollapsed ? 0 : 12,
            borderRadius: 8,
            background: appTheme === 'dark' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.06)',
            cursor: 'pointer',
            userSelect: 'none',
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: appTheme === 'dark' ? 'rgba(255, 255, 255, 0.85)' : '#1677ff',
              color: appTheme === 'dark' ? '#111' : '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: 14,
              flex: '0 0 auto',
            }}
          >
            L
          </div>
          {!sidebarCollapsed && (
            <div
              style={{
                marginLeft: 10,
                color: appTheme === 'dark' ? 'rgba(255, 255, 255, 0.92)' : 'rgba(0, 0, 0, 0.88)',
                fontWeight: 700,
                fontSize: 16,
                lineHeight: 1,
              }}
            >
              Lingux
              <div style={{ marginTop: 2, color: appTheme === 'dark' ? 'rgba(255, 255, 255, 0.65)' : 'rgba(0, 0, 0, 0.45)', fontWeight: 500, fontSize: 12 }}>
                Translation
              </div>
            </div>
          )}
        </div>
        <Menu
          theme={appTheme}
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={(info) => {
            if (info.key !== 'back') {
              navigate(info.key);
            } else {
              // Handle back button click explicitly if needed, though onClick in item works too
              navigate('/projects');
            }
          }}
        />
      </Sider>
      <Layout>
        <Header style={{ padding: '0 16px', background: colorBgContainer, display: 'flex', alignItems: 'center' }}>
          <Button
            type="text"
            icon={sidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            style={{
              fontSize: '16px',
              width: 64,
              height: 64,
              marginRight: 16,
            }}
          />
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600, flex: 1 }}>
            {projectId ? 'Project Workspace' : 'Lingux Translation Management'}
          </h2>
          <Button
            type="text"
            icon={appTheme === 'dark' ? <SunOutlined /> : <MoonOutlined />}
            onClick={toggleTheme}
            style={{ marginRight: 16 }}
          />
        </Header>
        <Content
          style={{
            margin: '24px 16px',
            padding: 24,
            minHeight: 280,
            background: colorBgContainer,
            borderRadius: borderRadiusLG,
            overflow: 'auto',
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout;
