import React, { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Layout, Button, Card, Typography, Space, message } from "antd";
import { MessageOutlined } from "@ant-design/icons";
import { useAppStore } from "@/store/useAppStore";

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
        </Card>
      </Content>
    </Layout>
  );
};

export default LoginPage;
