import { Form, Button, Card, Space } from 'antd';
import { EyeOutlined } from '@ant-design/icons';
import { UrlInput } from '../shared';
import { ViewerFormValues } from '../../types/viewer';
import { PLACEHOLDER_URL } from '../../constants/viewer';

interface LoadPageFormProps {
  form: any;
  loading: boolean;
  onSubmit: (values: ViewerFormValues) => Promise<void>;
}

export const LoadPageForm: React.FC<LoadPageFormProps> = ({
  form,
  loading,
  onSubmit
}) => {
  return (
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
        onFinish={onSubmit}
        size="large"
      >
        <UrlInput
          name="pageUrl"
          label="Page URL"
          placeholder={PLACEHOLDER_URL}
          tooltip="The Confluence page you want to view"
          required
        />

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
    </Card>
  );
};