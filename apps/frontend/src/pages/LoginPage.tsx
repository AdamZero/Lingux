import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Layout, Button, Card, Typography, Space, message } from 'antd';
import {  MessageOutlined } from '@ant-design/icons';
import { useAppStore } from '@/store/useAppStore';

const { Content } = Layout;
const { Title, Text } = Typography;

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setToken, setUser, isAuthenticated } = useAppStore();

  // Check for token in URL (from hash fragment for security)
  useEffect(() => {
    // Check hash fragment first (more secure)
    const hash = window.location.hash.substring(1);
    const hashParams = new URLSearchParams(hash);
    const token = hashParams.get('token');
    const userStr = hashParams.get('user');

    // Fallback to search params for compatibility
    const searchToken = searchParams.get('token');
    const searchUserStr = searchParams.get('user');

    const finalToken = token || searchToken;
    const finalUserStr = userStr || searchUserStr;

    if (finalToken && finalUserStr) {
      try {
        const user = JSON.parse(finalUserStr);
        setToken(finalToken);
        setUser(user);
        message.success('Login successful');
        navigate('/projects');
      } catch (error) {
        message.error('Failed to parse user data');
      }
    }
  }, [searchParams, setToken, setUser, navigate]);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/projects');
    }
  }, [isAuthenticated, navigate]);

  const handleFeishuLogin = () => {
    window.location.href = 'http://localhost:3001/auth/feishu';
  };

  const handleQixinLogin = () => {
    window.location.href = 'http://localhost:3001/auth/qixin';
  };

  const handleDingTalkLogin = () => {
    window.location.href = 'http://localhost:3001/auth/dingtalk';
  };

  return (
    <Layout style={{ minHeight: '100vh', background: '#f0f2f5' }}>
      <Content style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <Card style={{ width: 400, textAlign: 'center' }}>
          <Title level={2}>Lingux Login</Title>
          <Text style={{ marginBottom: 24, display: 'block' }}>Sign in with your corporate account</Text>
          
          <Space direction="vertical" style={{ width: '100%' }}>
            <Button
              type="primary"
              size="large"
              icon={<MessageOutlined />}
              onClick={handleFeishuLogin}
              style={{ width: '100%' }}
            >
              Sign in with Feishu
            </Button>
            
            <Button
              type="default"
              size="large"
              icon={<MessageOutlined />}
              onClick={handleQixinLogin}
              style={{ width: '100%' }}
            >
              Sign in with Qixin
            </Button>
            
            <Button
              type="default"
              size="large"
              icon={<MessageOutlined />}
              onClick={handleDingTalkLogin}
              style={{ width: '100%' }}
            >
              Sign in with DingTalk
            </Button>
          </Space>
        </Card>
      </Content>
    </Layout>
  );
};

export default LoginPage;