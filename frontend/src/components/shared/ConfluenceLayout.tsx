import React from 'react';
import { Layout, theme } from 'antd';

const { Header, Content } = Layout;

interface ConfluenceLayoutProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}

export const ConfluenceLayout: React.FC<ConfluenceLayoutProps> = ({
  title,
  icon,
  children
}) => {
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ display: 'flex', alignItems: 'center', padding: '0 24px' }}>
        <div style={{ color: 'white', fontSize: '18px', fontWeight: 'bold' }}>
          {icon}
          {title}
        </div>
      </Header>

      <Content style={{ padding: '24px', minHeight: 280 }}>
        <div
          style={{
            background: colorBgContainer,
            minHeight: 280,
            padding: 24,
            borderRadius: borderRadiusLG,
          }}
        >
          {children}
        </div>
      </Content>
    </Layout>
  );
};