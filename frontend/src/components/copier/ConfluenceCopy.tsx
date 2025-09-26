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
  newTitle: string;
}

export default function ConfluenceCopy() {
  const [form] = Form.useForm<FormValues>();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const { extractSpaceAndTitle } = useConfluenceValidation();



  const handleCopy = async (values: FormValues) => {
    setLoading(true);
    setResult(null);

    try {
      const request: ConfluencePageRequest = {
        sourceUrl: values.sourceUrl,
        parentUrl: values.parentUrl || undefined,
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
      title: 'New Title',
      description: 'Specify the title for your copied page. The page will be copied to the same space as the source.'
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

                  <Alert
                    message="Same Space Copy"
                    description="The page will be copied to the same space as the source page. No need to specify a target space."
                    type="info"
                    showIcon
                    style={{ marginBottom: 16 }}
                  />

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

                <div style={{ marginTop: 16 }}>
                  <Text style={{ fontSize: '12px' }}>
                    📋 Pages are copied to the same space as the source page
                  </Text>
                </div>
              </Card>
            </Col>
          </Row>
    </ConfluenceLayout>
  );
}