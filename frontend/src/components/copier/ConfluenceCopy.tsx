import React, { useState, useEffect } from "react";
import {
  Card,
  Form,
  Input,
  Button,
  Space,
  Typography,
  Alert,
  notification,
  Row,
  Col,
  Divider,
  Tooltip
} from "antd";
import {
  CopyOutlined,
  FolderOutlined,
  FileTextOutlined,
  InfoCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined
} from "@ant-design/icons";
import { confluenceApi, ConfluencePageRequest, ConfluenceSpace } from "../../services/confluenceApi";
import { ConfluenceLayout, UrlInput, InstructionsCard, InstructionStep } from '../shared';
import { useConfluenceValidation } from '../../hooks';

const { Title, Text, Paragraph } = Typography;

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
  const { extractSpaceAndTitle } = useConfluenceValidation();

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
        const { spaceKey: sourceSpaceKey } = extractSpaceAndTitle(url);

        if (sourceSpaceKey && !targetSpaceConfirmed) {
          setTargetSpaceInput(sourceSpaceKey);
          validateTargetSpace(sourceSpaceKey);
        }
      } catch (error) {
        // Ignore extraction errors, keep default behavior
      }
    }
  };

  const instructionSteps: InstructionStep[] = [
    {
      title: 'Source Page URL',
      description: 'Copy the full URL of the Confluence page you want to duplicate'
    },
    {
      title: 'Parent Page (Optional)',
      description: 'If you want to place the copy under a specific parent page, provide its URL'
    },
    {
      title: 'Target Space',
      description: 'Enter the space key (e.g., EBR, TECH) where you want to copy the page. The system will check if it\'s writable, then you must confirm it before proceeding.'
    },
    {
      title: 'New Title',
      description: 'Specify the title for your copied page. It will auto-suggest based on the source.'
    }
  ];

  return (
    <ConfluenceLayout
      title="Confluence Page Copy Tool"
      icon={<CopyOutlined style={{ marginRight: 8 }} />}
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
                  <UrlInput
                    name="sourceUrl"
                    label="Source Page URL"
                    placeholder="https://inside-docupedia.bosch.com/confluence/display/EBR/OD+CHERY+T28+EU+BL05+RC6.1"
                    tooltip="The Confluence page you want to copy from"
                    required
                    onChange={handleSourceUrlChange}
                  />

                  <UrlInput
                    name="parentUrl"
                    label="Parent Page URL (Optional)"
                    placeholder="https://inside-docupedia.bosch.com/confluence/display/EBR/OD+CHERY+T28+EU+BL05"
                    tooltip="The parent page where the copy will be placed as a child"
                  />

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
              <InstructionsCard
                title="📋 Instructions"
                steps={instructionSteps}
              />

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
    </ConfluenceLayout>
  );
}