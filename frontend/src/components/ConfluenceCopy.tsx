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
  const [defaultSpaces] = useState<ConfluenceSpace[]>([
    { key: 'EBR', name: 'Engineering Base Release' },
    { key: 'TECH', name: 'Technical Documentation' },
    { key: 'PROJ', name: 'Project Documentation' }
  ]);
  const [result, setResult] = useState<string | null>(null);
  const [targetSpaceInput, setTargetSpaceInput] = useState<string>('');
  const [targetSpaceValidating, setTargetSpaceValidating] = useState(false);
  const [targetSpaceValid, setTargetSpaceValid] = useState<boolean | null>(null);
  const [targetSpaceExists, setTargetSpaceExists] = useState<boolean | null>(null);
  const [targetSpaceConfirmed, setTargetSpaceConfirmed] = useState(false);
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

      // Merge with default spaces, prioritizing fetched spaces
      const allSpaces = [...spacesList];
      defaultSpaces.forEach(defaultSpace => {
        if (!spacesList.find(s => s.key === defaultSpace.key)) {
          allSpaces.push(defaultSpace);
        }
      });

      setSpaces(allSpaces);

      // Skip write permission testing during initial load
      // We'll only test when user specifically enters a space
      setWritableSpaces([]); // Empty for now

    } catch (error) {
      // Fallback to default spaces if API fails
      setSpaces(defaultSpaces);
      setWritableSpaces([]);

      notification.warning({
        message: 'Using default spaces',
        description: 'Could not load all spaces from server. Using common spaces as fallback.'
      });
    } finally {
      setSpacesLoading(false);
    }
  };

  const handleCopy = async (values: FormValues) => {
    if (!targetSpaceConfirmed) {
      notification.error({
        message: 'Target Space Not Confirmed',
        description: 'Please enter and confirm a writable Target Space before copying',
        duration: 5
      });
      return;
    }

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

      // Reset form and states after successful copy
      form.resetFields();
      setTargetSpaceInput('');
      setTargetSpaceValid(null);
      setTargetSpaceConfirmed(false);
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

  const validateTargetSpace = async (spaceKey: string): Promise<boolean> => {
    if (!spaceKey) return false;

    setTargetSpaceValidating(true);
    try {
      console.log(`React app: Validating target space: ${spaceKey}`);
      // Only check if space exists - no write permission test
      const exists = await confluenceApi.checkSpaceExists(spaceKey);
      console.log(`React app: Space ${spaceKey} exists:`, exists);
      setTargetSpaceExists(exists);
      setTargetSpaceValid(exists); // If space exists, consider it valid

      return exists;
    } catch (error: any) {
      console.error(`React app: Error validating space ${spaceKey}:`, error);
      setTargetSpaceExists(false);
      setTargetSpaceValid(false);
      return false;
    } finally {
      setTargetSpaceValidating(false);
    }
  };

  const handleTargetSpaceChange = async (value: string) => {
    setTargetSpaceInput(value.toUpperCase());
    setTargetSpaceConfirmed(false);
    setTargetSpaceValid(null);

    if (value.trim()) {
      await validateTargetSpace(value.trim().toUpperCase());
    }
  };

  const handleTargetSpaceConfirm = () => {
    if (targetSpaceInput) {
      if (targetSpaceValid) {
        // Space exists and is confirmed
        setTargetSpaceConfirmed(true);
        form.setFieldsValue({ targetSpaceKey: targetSpaceInput });
        notification.success({
          message: 'Target Space Confirmed',
          description: `${targetSpaceInput} space exists and is ready to use`,
          duration: 3
        });
      } else {
        notification.error({
          message: 'Cannot Confirm Target Space',
          description: `Space "${targetSpaceInput}" does not exist or is not accessible`,
          duration: 3
        });
      }
    }
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

      // Auto-suggest target space from source URL if not already confirmed
      try {
        const urlPath = url.replace('https://inside-docupedia.bosch.com/confluence', '');
        const parts = urlPath.split('/');
        const sourceSpaceKey = parts[3]; // Extract space key from URL

        if (sourceSpaceKey && !targetSpaceConfirmed) {
          setTargetSpaceInput(sourceSpaceKey);
          validateTargetSpace(sourceSpaceKey);
        }
      } catch (error) {
        // Ignore extraction errors, keep default behavior
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
                        <Tooltip title="Enter the Confluence space key where the copy will be created">
                          <InfoCircleOutlined style={{ color: '#666' }} />
                        </Tooltip>
                      </Space>
                    }
                  >
                    <Space.Compact style={{ width: '100%' }}>
                      <Input
                        placeholder="Enter space key (e.g., EBR, TECH)"
                        value={targetSpaceInput}
                        onChange={(e) => handleTargetSpaceChange(e.target.value)}
                        style={{ flex: 1 }}
                        status={
                          targetSpaceValidating ? undefined :
                          targetSpaceValid === false ? 'error' : undefined
                        }
                        suffix={
                          targetSpaceValidating ? (
                            <span style={{ color: '#1890ff' }}>Checking...</span>
                          ) : targetSpaceValid === true ? (
                            <CheckCircleOutlined style={{ color: '#52c41a' }} />
                          ) : targetSpaceValid === false ? (
                            <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
                          ) : null
                        }
                      />
                      <Button
                        type="primary"
                        onClick={handleTargetSpaceConfirm}
                        disabled={targetSpaceConfirmed || (!targetSpaceExists && !targetSpaceValidating)}
                        loading={targetSpaceValidating}
                      >
                        {targetSpaceConfirmed ? 'Confirmed' : 'Confirm'}
                      </Button>
                    </Space.Compact>

                    {targetSpaceExists === false && targetSpaceInput && (
                      <div style={{ marginTop: 8 }}>
                        <Text type="danger" style={{ fontSize: '12px' }}>
                          <ExclamationCircleOutlined style={{ marginRight: 4 }} />
                          Space "{targetSpaceInput}" does not exist or is not accessible
                        </Text>
                      </div>
                    )}

                    {targetSpaceExists === true && targetSpaceInput && (
                      <div style={{ marginTop: 8 }}>
                        <Text type="success" style={{ fontSize: '12px' }}>
                          <CheckCircleOutlined style={{ marginRight: 4 }} />
                          Space "{targetSpaceInput}" exists and is ready to use
                        </Text>
                      </div>
                    )}

                    {targetSpaceConfirmed && (
                      <div style={{ marginTop: 8 }}>
                        <Text type="success" style={{ fontSize: '12px' }}>
                          <CheckCircleOutlined style={{ marginRight: 4 }} />
                          Target space "{targetSpaceInput}" confirmed and ready
                        </Text>
                      </div>
                    )}
                  </Form.Item>

                  <Form.Item
                    name="targetSpaceKey"
                    hidden
                    rules={[{ required: true, message: 'Please confirm a target space' }]}
                  >
                    <Input />
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
                      disabled={!targetSpaceConfirmed}
                      block
                    >
                      {loading ? 'Copying Page...' :
                       !targetSpaceConfirmed ? 'Confirm Target Space First' :
                       'Copy Page'}
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
                      Enter the space key (e.g., EBR, TECH) where you want to copy the page.
                      The system will check if it's writable, then you must confirm it before proceeding.
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
                      {writableSpaces.includes('EBR') && ' (EBR set as default)'}
                    </Text>
                  </div>
                )}

                {spaces.length === 0 && !spacesLoading && (
                  <div style={{ marginTop: 16 }}>
                    <Text style={{ fontSize: '12px' }} type="warning">
                      ⚠️ Using fallback spaces. Check your connection.
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