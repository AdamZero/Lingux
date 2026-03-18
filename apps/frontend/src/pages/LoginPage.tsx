import React, { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Layout,
  Button,
  Card,
  Typography,
  Space,
  message,
  Divider,
  Select,
} from "antd";
import { MessageOutlined, CodeOutlined } from "@ant-design/icons";
import { useAppStore } from "@/store/useAppStore";

const { Option } = Select;

// 开发环境快速登录账号列表
const DEV_ACCOUNTS = [
  {
    username: "admin@demo",
    name: "演示管理员",
    role: "ADMIN",
    platform: "飞书",
  },
  {
    username: "editor@demo",
    name: "演示编辑",
    role: "EDITOR",
    platform: "飞书",
  },
  {
    username: "reviewer@demo",
    name: "演示审核员",
    role: "REVIEWER",
    platform: "飞书",
  },
  {
    username: "admin@test",
    name: "测试管理员",
    role: "ADMIN",
    platform: "钉钉",
  },
  {
    username: "editor@test",
    name: "测试编辑",
    role: "EDITOR",
    platform: "钉钉",
  },
];

const { Content } = Layout;
const { Title, Text } = Typography;

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const setToken = useAppStore((state) => state.setToken);
  const setUser = useAppStore((state) => state.setUser);
  const token = useAppStore((state) => state.token);

  useEffect(() => {
    const hash = window.location.hash.substring(1);
    const hashParams = new URLSearchParams(hash);
    const tokenFromUrl = hashParams.get("token");
    const userStrFromUrl = hashParams.get("user");

    const tokenFromSearch = searchParams.get("token");
    const userStrFromSearch = searchParams.get("user");

    const finalToken = tokenFromUrl || tokenFromSearch;
    const finalUserStr = userStrFromUrl || userStrFromSearch;

    if (finalToken && finalUserStr) {
      try {
        const user = JSON.parse(finalUserStr);
        setToken(finalToken);
        setUser(user);
        message.success("登录成功");
        window.history.replaceState(null, "", window.location.pathname);
      } catch {
        message.error("用户数据解析失败");
      }
    }
  }, [searchParams, setToken, setUser]);

  useEffect(() => {
    if (token) {
      navigate("/projects", { replace: true });
    }
  }, [token, navigate]);

  const handleFeishuLogin = () => {
    window.location.href = "/api/v1/auth/feishu";
  };

  const handleQixinLogin = () => {
    window.location.href = "/api/v1/auth/qixin";
  };

  const handleDingTalkLogin = () => {
    window.location.href = "/api/v1/auth/dingtalk";
  };

  // 开发环境快速登录
  const handleDevLogin = (username: string) => {
    window.location.href = `/api/v1/auth/dev-login?username=${encodeURIComponent(username)}`;
  };

  // 判断是否为开发环境
  const isDevelopment =
    process.env.NODE_ENV === "development" ||
    window.location.hostname === "localhost";

  return (
    <Layout style={{ minHeight: "100vh", background: "#f0f2f5" }}>
      <Content
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "100vh",
        }}
      >
        <Card style={{ width: 400, textAlign: "center" }}>
          <Title level={2}>Lingux Login</Title>
          <Text style={{ marginBottom: 24, display: "block" }}>
            Sign in with your corporate account
          </Text>

          <Space direction="vertical" style={{ width: "100%" }}>
            <Button
              type="primary"
              size="large"
              block
              icon={<MessageOutlined />}
              onClick={handleFeishuLogin}
            >
              飞书登录
            </Button>
            <Button size="large" block onClick={handleQixinLogin}>
              企信登录
            </Button>
            <Button size="large" block onClick={handleDingTalkLogin}>
              钉钉登录
            </Button>
          </Space>

          {isDevelopment && (
            <>
              <Divider>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  开发环境快速登录
                </Text>
              </Divider>
              <Space direction="vertical" style={{ width: "100%" }}>
                <Select
                  placeholder="选择开发账号快速登录"
                  size="large"
                  style={{ width: "100%" }}
                  onChange={handleDevLogin}
                  value={undefined}
                >
                  {DEV_ACCOUNTS.map((account) => (
                    <Option key={account.username} value={account.username}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <span>
                          <CodeOutlined style={{ marginRight: 8 }} />
                          {account.name}
                        </span>
                        <span style={{ fontSize: 12, color: "#999" }}>
                          {account.platform} · {account.role}
                        </span>
                      </div>
                    </Option>
                  ))}
                </Select>
              </Space>
            </>
          )}
        </Card>
      </Content>
    </Layout>
  );
};

export default LoginPage;
