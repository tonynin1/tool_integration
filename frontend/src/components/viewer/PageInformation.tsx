import { Card, Space, Typography, Divider } from 'antd';
import { PageContent } from '../../types/viewer';

const { Text } = Typography;

interface PageInformationProps {
  pageContent: PageContent;
}

const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleString();
};

export const PageInformation: React.FC<PageInformationProps> = ({ pageContent }) => {
  return (
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
  );
};