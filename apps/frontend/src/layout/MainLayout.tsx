import React, { useMemo, useState, useEffect } from "react";
import { Layout, Menu, theme, Button, Drawer } from "antd";
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  HomeOutlined,
  ProjectOutlined,
  CheckCircleOutlined,
  RocketOutlined,
  SettingOutlined,
  ArrowLeftOutlined,
  SunOutlined,
  MoonOutlined,
} from "@ant-design/icons";
import { Outlet, useNavigate, useLocation, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAppStore } from "@/store/useAppStore";
import { usePermission } from "@/hooks/usePermission";
import apiClient from "@/api/client";

const { Header, Sider, Content } = Layout;

// 响应式断点
const BREAKPOINT_MD = 768;
const BREAKPOINT_LG = 1024;

const MainLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { projectId } = useParams();
  const {
    sidebarCollapsed,
    setSidebarCollapsed,
    theme: appTheme,
    toggleTheme,
  } = useAppStore();
  const { canReview, features } = usePermission();
  const [projectName, setProjectName] = useState("");

  const [isMobile, setIsMobile] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      setIsMobile(width < BREAKPOINT_MD);

      if (width < BREAKPOINT_MD) {
        setSidebarCollapsed(true);
      } else if (width >= BREAKPOINT_LG) {
        setSidebarCollapsed(false);
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [setSidebarCollapsed]);

  const { data: project } = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => {
      if (!projectId) return null;
      const res = await apiClient.get(`/projects/${projectId}`);
      return res;
    },
    enabled: !!projectId,
  });

  React.useEffect(() => {
    if (project?.name) {
      setProjectName(project.name);
    } else if (projectId) {
      setProjectName("Project Workspace");
    } else {
      setProjectName("");
    }
  }, [project, projectId]);

  const isInProject = !!projectId;
  const {
    token: { colorBgContainer, borderRadiusLG, colorBgLayout },
  } = theme.useToken();

  const menuItems = useMemo(() => {
    const items = [
      {
        key: "/workspace",
        icon: <HomeOutlined />,
        label: "工作台",
      },
      {
        key: "/projects",
        icon: <ProjectOutlined />,
        label: "项目列表",
      },
    ];

    if (canReview && features?.review) {
      items.push({
        key: "/reviews",
        icon: <CheckCircleOutlined />,
        label: "审核工作台",
      });
    }

    items.push({
      key: "/releases",
      icon: <RocketOutlined />,
      label: "发布中心",
    });

    items.push({
      key: "/settings",
      icon: <SettingOutlined />,
      label: "配置中心",
    });

    return items;
  }, [canReview, features]);

  const siderWidth = isMobile ? 0 : sidebarCollapsed ? 64 : 180;

  const handleMenuClick = (info: { key: string }) => {
    if (info.key !== "back") {
      navigate(info.key);
    } else {
      navigate("/projects");
    }
    if (isMobile) {
      setMobileDrawerOpen(false);
    }
  };

  const renderSiderContent = () => (
    <>
      <div
        onClick={() => navigate("/projects")}
        style={{
          height: 40,
          margin: "12px 8px",
          display: "flex",
          alignItems: "center",
          justifyContent:
            sidebarCollapsed && !isMobile ? "center" : "flex-start",
          paddingInline: sidebarCollapsed && !isMobile ? 0 : 10,
          borderRadius: 6,
          background:
            appTheme === "dark"
              ? "rgba(255, 255, 255, 0.08)"
              : "rgba(0, 0, 0, 0.04)",
          cursor: "pointer",
          userSelect: "none",
          transition: "all 0.2s ease",
        }}
      >
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: 6,
            background:
              appTheme === "dark" ? "rgba(255, 255, 255, 0.85)" : "#1677ff",
            color: appTheme === "dark" ? "#111" : "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 800,
            fontSize: 12,
            flex: "0 0 auto",
          }}
        >
          L
        </div>
        {(!sidebarCollapsed || isMobile) && (
          <div
            style={{
              marginLeft: 8,
              color:
                appTheme === "dark"
                  ? "rgba(255, 255, 255, 0.92)"
                  : "rgba(0, 0, 0, 0.88)",
              fontWeight: 600,
              fontSize: 14,
              lineHeight: 1.2,
            }}
          >
            Lingux
            <div
              style={{
                color:
                  appTheme === "dark"
                    ? "rgba(255, 255, 255, 0.55)"
                    : "rgba(0, 0, 0, 0.45)",
                fontWeight: 400,
                fontSize: 11,
              }}
            >
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
        onClick={handleMenuClick}
        style={{
          borderRight: "none",
          fontSize: 13,
        }}
      />
    </>
  );

  return (
    <Layout
      style={{ height: "100vh", background: colorBgLayout, overflow: "hidden" }}
    >
      {!isMobile && (
        <Sider
          trigger={null}
          collapsible
          collapsed={sidebarCollapsed}
          collapsedWidth={64}
          width={180}
          theme={appTheme}
          style={{
            height: "100vh",
            position: "fixed",
            left: 0,
            top: 0,
            bottom: 0,
            overflow: "auto",
          }}
        >
          {renderSiderContent()}
        </Sider>
      )}

      <Drawer
        placement="left"
        closable={false}
        onClose={() => setMobileDrawerOpen(false)}
        open={mobileDrawerOpen}
        width={180}
        bodyStyle={{ padding: 0 }}
        headerStyle={{ display: "none" }}
        style={{
          background: appTheme === "dark" ? "#001529" : "#fff",
        }}
      >
        <div
          style={{
            background: appTheme === "dark" ? "#001529" : "#fff",
            minHeight: "100vh",
          }}
        >
          {renderSiderContent()}
        </div>
      </Drawer>

      <Layout
        style={{
          marginLeft: siderWidth,
          height: "100vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          transition: "margin-left 0.2s ease",
        }}
      >
        <Header
          style={{
            padding: isMobile ? "0 12px" : "0 16px",
            height: 48,
            lineHeight: "48px",
            background: colorBgContainer,
            display: "flex",
            alignItems: "center",
            flexShrink: 0,
            borderBottom: "1px solid var(--color-border)",
          }}
        >
          <Button
            type="text"
            icon={
              isInProject ? (
                <ArrowLeftOutlined />
              ) : isMobile ? (
                <MenuUnfoldOutlined />
              ) : sidebarCollapsed ? (
                <MenuUnfoldOutlined />
              ) : (
                <MenuFoldOutlined />
              )
            }
            onClick={
              isInProject
                ? () => navigate("/projects")
                : isMobile
                  ? () => setMobileDrawerOpen(true)
                  : () => setSidebarCollapsed(!sidebarCollapsed)
            }
            style={{
              fontSize: 14,
              width: 32,
              height: 32,
              marginRight: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          />
          <h2
            style={{
              margin: 0,
              fontSize: isMobile ? 14 : 15,
              fontWeight: 600,
              flex: 1,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {isMobile && projectName
              ? projectName
              : projectName ||
                (isInProject
                  ? "Project Workspace"
                  : "Lingux Translation Management")}
          </h2>
          <Button
            type="text"
            icon={appTheme === "dark" ? <SunOutlined /> : <MoonOutlined />}
            onClick={toggleTheme}
            style={{
              width: 32,
              height: 32,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          />
        </Header>
        <Content
          style={{
            margin: isMobile ? 8 : 12,
            padding: isMobile ? 12 : 16,
            background: colorBgContainer,
            borderRadius: borderRadiusLG,
            overflow: "auto",
            flex: 1,
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout;
