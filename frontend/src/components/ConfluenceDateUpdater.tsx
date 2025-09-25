import React, { useState } from 'react';
import {
  Card,
  Form,
  Input,
  DatePicker,
  Button,
  Alert,
  Spin,
  Typography,
  Divider,
  Space,
  Row,
  Col,
  message,
} from 'antd';
import {
  CalendarOutlined,
  LinkOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { format } from 'date-fns';
import axios from 'axios';

const { Title, Text, Paragraph } = Typography;

interface UpdateResult {
  success: boolean;
  message: string;
  oldDate?: string;
  newDate?: string;
  pageTitle?: string;
  version?: number;
}

const ConfluenceDateUpdater: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<UpdateResult | null>(null);

  const handleSubmit = async (values: {
    pageUrl: string;
    newDate: any;
  }) => {
    setLoading(true);
    setResult(null);

    try {
      const dateString = format(values.newDate.toDate(), 'yyyy-MM-dd');

      message.loading('Updating Confluence page via Python script...', 0);

      // Call the simple Node.js server that runs the Python script
      const response = await axios.post('http://localhost:3002/api/update-date', {
        pageUrl: values.pageUrl,
        newDate: dateString,
      }, {
        timeout: 30000
      });

      message.destroy();

      if (response.data.success) {
        message.success('Page updated successfully!');
        setResult({
          success: true,
          message: response.data.message,
          oldDate: response.data.oldDate,
          newDate: response.data.newDate,
          pageTitle: response.data.pageTitle,
          version: response.data.version,
        });
      } else {
        message.error('Failed to update page');
        setResult({
          success: false,
          message: response.data.message || 'Update failed',
        });
      }
    } catch (error) {
      message.destroy();
      message.error('Error updating page');
      console.error('Update error:', error);

      let errorMessage = 'Unknown error occurred';
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNREFUSED') {
          errorMessage = 'Cannot connect to update server. Make sure the server is running on port 3002.';
        } else if (error.response?.data?.message) {
          errorMessage = error.response.data.message;
        } else {
          errorMessage = error.message;
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      setResult({
        success: false,
        message: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  const validateConfluenceUrl = (url: string): boolean => {
    // Check if it's a valid Confluence display URL
    return url.includes('inside-docupedia.bosch.com/confluence/display/') && url.includes('/');
  };

  return (
    <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
      <Card>
        <Title level={2}>
          <CalendarOutlined /> Confluence Page Date Updater
        </Title>

        <Paragraph>
          Update the release date on Confluence pages using the proven Python script backend.
          This tool specifically targets pages with <code>&lt;time datetime=""&gt;</code> tags
          for precise updates through the Bosch proxy.
        </Paragraph>

        <Alert
          message="Server Requirement"
          description="Make sure the update server is running on port 3002: node update-date-simple.js"
          type="info"
          style={{ marginBottom: 16 }}
          showIcon
        />

        <Divider />

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            newDate: undefined,
            pageUrl: '',
          }}
        >
          <Form.Item
            label="Confluence Page URL"
            name="pageUrl"
            rules={[
              { required: true, message: 'Please enter the Confluence page URL' },
              {
                validator: (_, value) => {
                  if (!value) return Promise.resolve();
                  if (validateConfluenceUrl(value)) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('Please enter a valid Confluence display URL'));
                }
              }
            ]}
            help="Paste the full Confluence URL from your browser address bar"
          >
            <Input
              prefix={<LinkOutlined />}
              placeholder="https://inside-docupedia.bosch.com/confluence/display/EBR/GWM+FVE0120+BL02+V6.4"
              size="large"
            />
          </Form.Item>

          <Form.Item
            label="New Release Date"
            name="newDate"
            rules={[{ required: true, message: 'Please select a date' }]}
          >
            <DatePicker
              style={{ width: '100%' }}
              format="YYYY-MM-DD"
              placeholder="Select new release date"
            />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                icon={<CalendarOutlined />}
              >
                Update Release Date
              </Button>

              <Button
                onClick={() => {
                  form.resetFields();
                  setResult(null);
                }}
              >
                Reset
              </Button>
            </Space>
          </Form.Item>
        </Form>

        {result && (
          <>
            <Divider />

            {result.success ? (
              <Alert
                message="Update Successful"
                description={
                  <div>
                    <p><strong>Page:</strong> {result.pageTitle}</p>
                    <p><strong>Previous Date:</strong> {result.oldDate}</p>
                    <p><strong>New Date:</strong> {result.newDate}</p>
                    <p><strong>New Version:</strong> {result.version}</p>
                  </div>
                }
                type="success"
                icon={<CheckCircleOutlined />}
                showIcon
              />
            ) : (
              <Alert
                message="Update Failed"
                description={result.message}
                type="error"
                icon={<ExclamationCircleOutlined />}
                showIcon
              />
            )}
          </>
        )}

        <Divider />

        <Card size="small" type="inner" title="How to get the Confluence URL">
          <Paragraph>
            <Text strong>Step 1:</Text> Navigate to your Confluence page in your browser
          </Paragraph>
          <Paragraph>
            <Text strong>Step 2:</Text> Copy the URL from the address bar (should look like:
            <code>https://inside-docupedia.bosch.com/confluence/display/SPACE/Page+Title</code>)
          </Paragraph>
          <Paragraph>
            <Text strong>Step 3:</Text> Paste it in the URL field above - that's it! No need to find page IDs anymore.
          </Paragraph>
        </Card>
      </Card>

      {loading && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(255,255,255,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <Spin size="large" />
        </div>
      )}
    </div>
  );
};

export default ConfluenceDateUpdater;