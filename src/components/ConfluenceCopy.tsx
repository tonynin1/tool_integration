import React, { useState, useEffect } from "react";
import {
  Card,
  Form,
  Input,
  Button,
  Select,
  Space,
  Typography,
  Alert,
  notification,
  Row,
  Col,
  Divider,
  Tooltip,
  Layout,
  theme
} from "antd";
import {
  CopyOutlined,
  LinkOutlined,
  FolderOutlined,
  FileTextOutlined,
  InfoCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined
} from "@ant-design/icons";
import { confluenceApi, ConfluencePageRequest, ConfluenceSpace } from "../services/confluenceApi";

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { Header, Content } = Layout;

interface FormValues {
  sourceUrl: string;
  parentUrl?: string;
  targetSpaceKey: string;
  newTitle: string;
}

export default function ConfluenceCopy() {
  const [form] = Form.useForm<FormValues>();
  const [loading, setLoading] = useState(false);
  const [spaces, setSpaces] = useState<ConfluenceSpace[]>([]);
  const [spacesLoading, setSpacesLoading] = useState(false);
  const [writableSpaces, setWritableSpaces] = useState<string[]>([]);
  const [result, setResult] = useState<string | null>(null);
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  useEffect(() => {
    loadSpaces();
  }, []);

  const loadSpaces = async () => {
    setSpacesLoading(true);
    try {
      const spacesList = await confluenceApi.getAccessibleSpaces();
      setSpaces(spacesList);

      // Test write permissions for first few spaces
      const writeableKeys: string[] = [];
      for (const space of spacesList.slice(0, 10)) { // Test first 10 spaces only
        const canWrite = await confluenceApi.testWritePermission(space.key);
        if (canWrite) {
          writeableKeys.push(space.key);
        }
      }
      setWritableSpaces(writeableKeys);
    } catch (error) {
      notification.error({
        message: 'Failed to load spaces',
        description: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setSpacesLoading(false);
    }
  };

  const handleCopy = async (values: FormValues) => {
    setLoading(true);
    setResult(null);

    try {
      const request: ConfluencePageRequest = {
        sourceUrl: values.sourceUrl,
        parentUrl: values.parentUrl || undefined,
        targetSpaceKey: values.targetSpaceKey,
        newTitle: values.newTitle
      };

      const copiedPage = await confluenceApi.copyPage(request);

      const pageUrl = `https://inside-docupedia.bosch.com/confluence${copiedPage._links.webui}`;
      setResult(pageUrl);

      notification.success({
        message: 'Page copied successfully!',
        description: `Created: ${copiedPage.title}`,
        duration: 5
      });

      // Reset form after successful copy
      form.resetFields();
    } catch (error) {
      notification.error({
        message: 'Failed to copy page',
        description: error instanceof Error ? error.message : 'Unknown error',
        duration: 10
      });
    } finally {
      setLoading(false);
    }
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

  const handleSourceUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value;
    if (url) {
      const extractedTitle = confluenceApi.extractTitleFromUrl(url);
      if (extractedTitle && !form.getFieldValue('newTitle')) {
        form.setFieldsValue({
          newTitle: `${extractedTitle} - Copy`
        });
      }
    }
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ display: 'flex', alignItems: 'center', padding: '0 24px' }}>
        <div style={{ color: 'white', fontSize: '18px', fontWeight: 'bold' }}>
          <CopyOutlined style={{ marginRight: 8 }} />
          Confluence Page Copy Tool
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
            <Col xs={24} lg={16}>
              <Card
                title={
                  <Space>
                    <CopyOutlined />
                    <span>Copy Confluence Page</span>
                  </Space>
                }
                style={{ marginBottom: 24 }}
              >
                <Form
                  form={form}
                  layout="vertical"
                  onFinish={handleCopy}
                  size="large"
                >
                  <Form.Item
                    label={
                      <Space>
                        <LinkOutlined />
                        <span>Source Page URL</span>
                        <Tooltip title="The Confluence page you want to copy from">
                          <InfoCircleOutlined style={{ color: '#666' }} />
                        </Tooltip>
                      </Space>
                    }
                    name="sourceUrl"
                    rules={[
                      { required: true, message: 'Please enter the source page URL' },
                      { validator: validateUrl }
                    ]}
                  >
                    <Input
                      placeholder="https://inside-docupedia.bosch.com/confluence/display/EBR/OD+CHERY+T28+EU+BL05+RC6.1"
                      onChange={handleSourceUrlChange}
                    />
                  </Form.Item>

                  <Form.Item
                    label={
                      <Space>
                        <FolderOutlined />
                        <span>Parent Page URL (Optional)</span>
                        <Tooltip title="The parent page where the copy will be placed as a child">
                          <InfoCircleOutlined style={{ color: '#666' }} />
                        </Tooltip>
                      </Space>
                    }
                    name="parentUrl"
                    rules={[{ validator: validateUrl }]}
                  >
                    <Input
                      placeholder="https://inside-docupedia.bosch.com/confluence/display/EBR/OD+CHERY+T28+EU+BL05"
                    />
                  </Form.Item>

                  <Form.Item
                    label={
                      <Space>
                        <span>Target Space</span>
                        <Tooltip title="The Confluence space where the copy will be created">
                          <InfoCircleOutlined style={{ color: '#666' }} />
                        </Tooltip>
                      </Space>
                    }
                    name="targetSpaceKey"
                    rules={[{ required: true, message: 'Please select a target space' }]}
                  >
                    <Select
                      placeholder="Select a space you can write to"
                      loading={spacesLoading}
                      showSearch
                      filterOption={(input, option) =>
                        (option?.children as any)?.props?.children?.[0]?.toLowerCase()?.includes(input.toLowerCase()) ||
                        (option?.children as any)?.props?.children?.[2]?.props?.children?.toLowerCase()?.includes(input.toLowerCase())
                      }
                    >
                      {spaces.map(space => (
                        <Option
                          key={space.key}
                          value={space.key}
                          disabled={!writableSpaces.includes(space.key)}
                        >
                          <Space>
                            <span>{space.key}</span>
                            <Text type="secondary">- {space.name}</Text>
                            {writableSpaces.includes(space.key) ? (
                              <Text type="success">
                                <CheckCircleOutlined style={{ marginRight: 4 }} />
                                Writable
                              </Text>
                            ) : (
                              <Text type="warning">
                                <ExclamationCircleOutlined style={{ marginRight: 4 }} />
                                Read-only
                              </Text>
                            )}
                          </Space>
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>

                  <Form.Item
                    label={
                      <Space>
                        <FileTextOutlined />
                        <span>New Page Title</span>
                        <Tooltip title="The title for the copied page">
                          <InfoCircleOutlined style={{ color: '#666' }} />
                        </Tooltip>
                      </Space>
                    }
                    name="newTitle"
                    rules={[{ required: true, message: 'Please enter a title for the new page' }]}
                  >
                    <Input placeholder="OD CHERY T28 EU BL05 RC6.2" />
                  </Form.Item>

                  <Form.Item>
                    <Button
                      type="primary"
                      htmlType="submit"
                      icon={<CopyOutlined />}
                      size="large"
                      loading={loading}
                      block
                    >
                      {loading ? 'Copying Page...' : 'Copy Page'}
                    </Button>
                  </Form.Item>
                </Form>

                {result && (
                  <>
                    <Divider />
                    <Alert
                      message="Page copied successfully!"
                      description={
                        <div>
                          <Paragraph>
                            Your page has been created successfully. You can access it at:
                          </Paragraph>
                          <Paragraph>
                            <a href={result} target="_blank" rel="noopener noreferrer">
                              {result}
                            </a>
                          </Paragraph>
                        </div>
                      }
                      type="success"
                      showIcon
                    />
                  </>
                )}
              </Card>
            </Col>

            <Col xs={24} lg={8}>
              <Card title="📋 Instructions" size="small" style={{ marginBottom: 16 }}>
                <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                  <div>
                    <Title level={5}>1. Source Page URL</Title>
                    <Text type="secondary">
                      Copy the full URL of the Confluence page you want to duplicate
                    </Text>
                  </div>

                  <div>
                    <Title level={5}>2. Parent Page (Optional)</Title>
                    <Text type="secondary">
                      If you want to place the copy under a specific parent page, provide its URL
                    </Text>
                  </div>

                  <div>
                    <Title level={5}>3. Target Space</Title>
                    <Text type="secondary">
                      Choose a space where you have write permissions. Only writable spaces are enabled.
                    </Text>
                  </div>

                  <div>
                    <Title level={5}>4. New Title</Title>
                    <Text type="secondary">
                      Specify the title for your copied page. It will auto-suggest based on the source.
                    </Text>
                  </div>
                </Space>
              </Card>

              <Card title="🔗 URL Format" size="small">
                <div>
                  <Title level={5}>Example:</Title>
                  <Text code style={{ fontSize: '12px', wordBreak: 'break-all' }}>
                    https://inside-docupedia.bosch.com/confluence/display/SPACE/Page+Title
                  </Text>
                </div>

                {spacesLoading && (
                  <div style={{ marginTop: 16 }}>
                    <Text style={{ fontSize: '12px' }}>
                      🔄 Loading spaces and checking permissions...
                    </Text>
                  </div>
                )}

                {writableSpaces.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <Text style={{ fontSize: '12px' }}>
                      ✅ Found {writableSpaces.length} writable space(s)
                    </Text>
                  </div>
                )}
              </Card>
            </Col>
          </Row>
        </div>
      </Content>
    </Layout>
  );
}