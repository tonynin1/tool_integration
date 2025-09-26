import { useState } from "react";
import {
  Card,
  Form,
  Input,
  Button,
  Space,
  Typography,
  notification,
  Row,
  Col,
  Divider,
  Tooltip,
  Layout,
  theme,
  Spin
} from "antd";
import {
  EyeOutlined,
  LinkOutlined,
  InfoCircleOutlined,
  ReloadOutlined
} from "@ant-design/icons";

const { Title, Text } = Typography;
const { Header, Content } = Layout;

interface ViewerFormValues {
  pageUrl: string;
}

interface PageContent {
  id: string;
  title: string;
  content: string;
  space: string;
  version: number;
  lastModified: string;
  author: string;
}

export default function ConfluenceViewer() {
  const [form] = Form.useForm<ViewerFormValues>();
  const [loading, setLoading] = useState(false);
  const [pageContent, setPageContent] = useState<PageContent | null>(null);
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  const handleViewPage = async (values: ViewerFormValues) => {
    setLoading(true);
    setPageContent(null);

    try {
      console.log('Fetching page:', values.pageUrl);

      // Extract space and title from URL
      const { spaceKey, title } = extractSpaceAndTitle(values.pageUrl);

      const response = await fetch(`http://localhost:3002/api/get-page`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          spaceKey,
          title
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const pageData = await response.json();

      setPageContent({
        id: pageData.id,
        title: pageData.title,
        content: pageData.body.storage.value,
        space: pageData.space.name,
        version: pageData.version.number,
        lastModified: pageData.version.when,
        author: pageData.version.by?.displayName || 'Unknown'
      });

      notification.success({
        message: 'Page loaded successfully!',
        description: `Loaded: ${pageData.title}`,
        duration: 3
      });

    } catch (error) {
      console.error('View page error:', error);
      notification.error({
        message: 'Failed to load page',
        description: error instanceof Error ? error.message : 'Unknown error',
        duration: 10
      });
    } finally {
      setLoading(false);
    }
  };

  const extractSpaceAndTitle = (pageUrl: string): { spaceKey: string; title: string } => {
    if (!pageUrl.includes('/confluence/display/')) {
      throw new Error('Invalid Confluence URL format');
    }

    const displayIndex = pageUrl.indexOf('/display/');
    const pathAfterDisplay = pageUrl.substring(displayIndex + '/display/'.length);
    const parts = pathAfterDisplay.split('/');

    if (parts.length < 2) {
      throw new Error('URL does not contain space and title');
    }

    const spaceKey = parts[0];
    const titlePart = parts[1];
    const title = decodeURIComponent(titlePart.replace(/\+/g, ' '));

    return { spaceKey, title };
  };

  const validateUrl = (_: any, value: string) => {
    if (!value) {
      return Promise.resolve();
    }

    const confluenceUrlPattern = /^https:\/\/inside-docupedia\.bosch\.com\/confluence\/display\/[A-Z0-9]+\/[^\/]+$/;
    if (!confluenceUrlPattern.test(value)) {
      return Promise.reject(new Error('Please enter a valid Confluence page URL'));
    }

    return Promise.resolve();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ display: 'flex', alignItems: 'center', padding: '0 24px' }}>
        <div style={{ color: 'white', fontSize: '18px', fontWeight: 'bold' }}>
          <EyeOutlined style={{ marginRight: 8 }} />
          Confluence Page Viewer
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
          <Row gutter={24}>
            <Col xs={24} lg={8}>
              <Card
                title={
                  <Space>
                    <EyeOutlined />
                    <span>Load Confluence Page</span>
                  </Space>
                }
                style={{ marginBottom: 24, height: 'fit-content' }}
              >
                <Form
                  form={form}
                  layout="vertical"
                  onFinish={handleViewPage}
                  size="large"
                >
                  <Form.Item
                    label={
                      <Space>
                        <LinkOutlined />
                        <span>Page URL</span>
                        <Tooltip title="The Confluence page you want to view">
                          <InfoCircleOutlined style={{ color: '#666' }} />
                        </Tooltip>
                      </Space>
                    }
                    name="pageUrl"
                    rules={[
                      { required: true, message: 'Please enter a page URL' },
                      { validator: validateUrl }
                    ]}
                  >
                    <Input
                      placeholder="https://inside-docupedia.bosch.com/confluence/display/EBR/GWM+FVE0120+BL02+V5"
                    />
                  </Form.Item>

                  <Form.Item>
                    <Button
                      type="primary"
                      htmlType="submit"
                      icon={<EyeOutlined />}
                      size="large"
                      loading={loading}
                      block
                    >
                      {loading ? 'Loading Page...' : 'Load Page'}
                    </Button>
                  </Form.Item>
                </Form>

                {pageContent && (
                  <>
                    <Divider />
                    <Card title="Page Information" size="small">
                      <Space direction="vertical" size="small" style={{ width: '100%' }}>
                        <div>
                          <Text strong>Title:</Text><br />
                          <Text>{pageContent.title}</Text>
                        </div>
                        <div>
                          <Text strong>Space:</Text><br />
                          <Text>{pageContent.space}</Text>
                        </div>
                        <div>
                          <Text strong>Version:</Text><br />
                          <Text>{pageContent.version}</Text>
                        </div>
                        <div>
                          <Text strong>Last Modified:</Text><br />
                          <Text>{formatDate(pageContent.lastModified)}</Text>
                        </div>
                        <div>
                          <Text strong>Author:</Text><br />
                          <Text>{pageContent.author}</Text>
                        </div>
                      </Space>
                    </Card>
                  </>
                )}
              </Card>

              <Card title="📝 Instructions" size="small">
                <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                  <div>
                    <Title level={5}>1. Enter URL</Title>
                    <Text type="secondary">
                      Paste the full URL of any Confluence page you want to view
                    </Text>
                  </div>

                  <div>
                    <Title level={5}>2. Load Content</Title>
                    <Text type="secondary">
                      Click "Load Page" to fetch and display the page content
                    </Text>
                  </div>

                  <div>
                    <Title level={5}>3. View Content</Title>
                    <Text type="secondary">
                      The page content will be displayed on the right with formatting preserved
                    </Text>
                  </div>
                </Space>
              </Card>
            </Col>

            <Col xs={24} lg={16}>
              {loading && (
                <Card>
                  <div style={{ textAlign: 'center', padding: '50px' }}>
                    <Spin size="large" />
                    <div style={{ marginTop: '16px' }}>
                      <Text>Loading page content...</Text>
                    </div>
                  </div>
                </Card>
              )}

              {!loading && !pageContent && (
                <Card>
                  <div style={{ textAlign: 'center', padding: '50px' }}>
                    <EyeOutlined style={{ fontSize: '48px', color: '#ccc', marginBottom: '16px' }} />
                    <div>
                      <Title level={4} type="secondary">No page loaded</Title>
                      <Text type="secondary">Enter a Confluence page URL to view its content</Text>
                    </div>
                  </div>
                </Card>
              )}

              {pageContent && (
                <Card
                  title={
                    <Space>
                      <Title level={4} style={{ margin: 0 }}>{pageContent.title}</Title>
                      <Button
                        icon={<ReloadOutlined />}
                        onClick={() => form.submit()}
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
              )}
            </Col>
          </Row>
        </div>
      </Content>
    </Layout>
  );
}