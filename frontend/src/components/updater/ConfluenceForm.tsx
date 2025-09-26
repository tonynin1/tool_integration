import React from 'react';
import {
  Form,
  Input,
  DatePicker,
  Button,
  Space,
  message,
} from 'antd';
import {
  CalendarOutlined,
  LinkOutlined,
} from '@ant-design/icons';
import { UpdateFormValues } from '../../types/confluence';

interface ConfluenceFormProps {
  onFinish: (values: UpdateFormValues) => void;
  loading: boolean;
  onReset: () => void;
}

const ConfluenceForm: React.FC<ConfluenceFormProps> = ({ onFinish, loading, onReset }) => {
  const [form] = Form.useForm();

  const validateConfluenceUrl = (url: string): boolean => {
    return url.includes('inside-docupedia.bosch.com/confluence/display/') && url.includes('/');
  };

  const handleFormSubmit = (values: UpdateFormValues) => {
    // Validate that at least one update field is provided
    if (!values.newDate && !values.newJiraKey && !values.newBaselineUrl && !values.newRepoBaselineUrl) {
      message.error('Please provide at least one field to update (date, Jira key, predecessor baseline, or repository baseline)');
      return;
    }
    onFinish(values);
  };

  const handleReset = () => {
    form.resetFields();
    onReset();
  };

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleFormSubmit}
      initialValues={{
        newDate: undefined,
        pageUrl: '',
        newJiraKey: '',
        newBaselineUrl: '',
        newRepoBaselineUrl: '',
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
        label="New Release Date (Optional)"
        name="newDate"
        help="Leave empty if you don't want to update the release date"
      >
        <DatePicker
          style={{ width: '100%' }}
          format="YYYY-MM-DD"
          placeholder="Select new release date (optional)"
        />
      </Form.Item>

      <Form.Item
        label="New Jira Ticket Key (Optional)"
        name="newJiraKey"
        help="Format: PROJECT-NUMBER (e.g., MPCTEGWMA-3000)"
        rules={[
          {
            validator: (_, value) => {
              if (!value) return Promise.resolve();
              if (/^[A-Z]+-[0-9]+$/.test(value.trim())) {
                return Promise.resolve();
              }
              return Promise.reject(new Error('Please enter a valid Jira key format (PROJECT-NUMBER)'));
            }
          }
        ]}
      >
        <Input
          placeholder="MPCTEGWMA-3000"
          size="large"
        />
      </Form.Item>

      <Form.Item
        label="New Predecessor Baseline URL (Optional)"
        name="newBaselineUrl"
        help="Full Confluence URL of the new predecessor baseline page"
        rules={[
          {
            validator: (_, value) => {
              if (!value) return Promise.resolve();
              if (validateConfluenceUrl(value.trim())) {
                return Promise.resolve();
              }
              return Promise.reject(new Error('Please enter a valid Confluence display URL'));
            }
          }
        ]}
      >
        <Input
          prefix={<LinkOutlined />}
          placeholder="https://inside-docupedia.bosch.com/confluence/display/EBR/GWM+FVE0120+BL02+V7.0"
          size="large"
        />
      </Form.Item>

      <Form.Item
        label="New Repository Baseline URL (Optional)"
        name="newRepoBaselineUrl"
        help="Repository baseline URL (e.g., from sourcecode06.dev.bosch.com)"
        rules={[
          {
            validator: (_, value) => {
              if (!value) return Promise.resolve();
              if (value.trim().startsWith('http') && value.includes('sourcecode')) {
                return Promise.resolve();
              }
              return Promise.reject(new Error('Please enter a valid repository URL containing "sourcecode"'));
            }
          }
        ]}
      >
        <Input
          prefix={<LinkOutlined />}
          placeholder="https://sourcecode06.dev.bosch.com/projects/G3N/repos/fvg3_lfs/commits?until=refs%2Fheads%2Frelease%2FCNGWM_FVE0120_BL02_V9"
          size="large"
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
            Update Page Content
          </Button>

          <Button onClick={handleReset}>
            Reset
          </Button>
        </Space>
      </Form.Item>
    </Form>
  );
};

export default ConfluenceForm;