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
const BREAKPOINT_MD = 768; // 平板/手机断点
const BREAKPOINT_LG = 1024; // 小桌面断点

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

  // 响应式状态
  const [isMobile, setIsMobile] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // 监听窗口大小变化
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      setIsMobile(width < BREAKPOINT_MD);

      // 自动折叠/展开侧边栏
      if (width < BREAKPOINT_MD) {
        setSidebarCollapsed(true);
      } else if (width >= BREAKPOINT_LG) {
        setSidebarCollapsed(false);
      }
    };

    handleResize(); // 初始检测
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
    // 始终显示全局菜单
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

    // 审核工作台（需要权限且功能开关开启）
    if (canReview && features?.review) {
      items.push({
        key: "/reviews",
        icon: <CheckCircleOutlined />,
        label: "审核工作台",
      });
    }

    //{/* 发布中心 */}
    items.push({
      key: "/releases",
      icon: <RocketOutlined />,
      label: "发布中心",
    });

    // 配置中心
    items.push({
      key: "/settings",
      icon: <SettingOutlined />,
      label: "配置中心",
    });

    return items;
  }, [canReview, features]);

  // 计算侧边栏宽度
  const siderWidth = isMobile ? 0 : sidebarCollapsed ? 80 : 200;

  // 移动端菜单点击处理
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

  // 侧边栏内容渲染
  const renderSiderContent = () => (
    <>
      <div
        onClick={() => navigate("/projects")}
        style={{
          height: 48,
          margin: 16,
          display: "flex",
          alignItems: "center",
          justifyContent:
            sidebarCollapsed && !isMobile ? "center" : "flex-start",
          paddingInline: sidebarCollapsed && !isMobile ? 0 : 12,
          borderRadius: 8,
          background:
            appTheme === "dark"
              ? "rgba(255, 255, 255, 0.12)"
              : "rgba(0, 0, 0, 0.06)",
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background:
              appTheme === "dark" ? "rgba(255, 255, 255, 0.85)" : "#1677ff",
            color: appTheme === "dark" ? "#111" : "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 800,
            fontSize: 14,
            flex: "0 0 auto",
          }}
        >
          L
        </div>
        {(!sidebarCollapsed || isMobile) && (
          <div
            style={{
              marginLeft: 10,
              color:
                appTheme === "dark"
                  ? "rgba(255, 255, 255, 0.92)"
                  : "rgba(0, 0, 0, 0.88)",
              fontWeight: 700,
              fontSize: 16,
              lineHeight: 1,
            }}
          >
            Lingux
            <div
              style={{
                marginTop: 2,
                color:
                  appTheme === "dark"
                    ? "rgba(255, 255, 255, 0.65)"
                    : "rgba(0, 0, 0, 0.45)",
                fontWeight: 500,
                fontSize: 12,
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
      />
    </>
  );

  return (
    <Layout
      style={{ height: "100vh", background: colorBgLayout, overflow: "hidden" }}
    >
      {/* 桌面端侧边栏 */}
      {!isMobile && (
        <Sider
          trigger={null}
          collapsible
          collapsed={sidebarCollapsed}
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

      {/* 移动端抽屉菜单 */}
      <Drawer
        placement="left"
        closable={false}
        onClose={() => setMobileDrawerOpen(false)}
        open={mobileDrawerOpen}
        width={200}
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
            background: colorBgContainer,
            display: "flex",
            alignItems: "center",
            flexShrink: 0,
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
              fontSize: "16px",
              width: isMobile ? 48 : 64,
              height: isMobile ? 48 : 64,
              marginRight: isMobile ? 8 : 16,
            }}
          />
          <h2
            style={{
              margin: 0,
              fontSize: isMobile ? "16px" : "18px",
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
            style={{ marginRight: isMobile ? 8 : 16 }}
          />
        </Header>
        <Content
          style={{
            margin: isMobile ? "12px" : "24px 16px",
            padding: isMobile ? 16 : 24,
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
