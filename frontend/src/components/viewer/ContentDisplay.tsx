import { Card, Button, Typography, Space, Spin } from 'antd';
import { EyeOutlined, ReloadOutlined } from '@ant-design/icons';
import { PageContent } from '../../types/viewer';

const { Title, Text } = Typography;

interface ContentDisplayProps {
  loading: boolean;
  pageContent: PageContent | null;
  onRefresh: () => void;
}

export const ContentDisplay: React.FC<ContentDisplayProps> = ({
  loading,
  pageContent,
  onRefresh
}) => {
  if (loading) {
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: '50px' }}>
          <Spin size="large" />
          <div style={{ marginTop: '16px' }}>
            <Text>Loading page content...</Text>
          </div>
        </div>
      </Card>
    );
  }

  if (!pageContent) {
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: '50px' }}>
          <EyeOutlined style={{ fontSize: '48px', color: '#ccc', marginBottom: '16px' }} />
          <div>
            <Title level={4} type="secondary">No page loaded</Title>
            <Text type="secondary">Enter a Confluence page URL to view its content</Text>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card
      title={
        <Space>
          <Title level={4} style={{ margin: 0 }}>{pageContent.title}</Title>
          <Button
            icon={<ReloadOutlined />}
            onClick={onRefresh}
            loading={loading}
          >
            Refresh
          </Button>
        </Space>
      }
      extra={
        <Text type="secondary">
          Version {pageContent.version} • {pageContent.space}
        </Text>
      }
    >
      <div
        style={{
          border: '1px solid #f0f0f0',
          borderRadius: '6px',
          padding: '20px',
          backgroundColor: '#fafafa',
          maxHeight: '80vh',
          overflow: 'auto'
        }}
        dangerouslySetInnerHTML={{
          __html: pageContent.content
        }}
      />
    </Card>
  );
};