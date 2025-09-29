import React from 'react';
import {
  Card,
  Alert,
  Divider,
  Typography,
} from 'antd';
import {
  CalendarOutlined,
} from '@ant-design/icons';

import ConfluenceForm from './ConfluenceForm';
import UpdateResults from './UpdateResults';
import ConfluenceInstructions from './ConfluenceInstructions';
import LoadingOverlay from './LoadingOverlay';
import { useConfluenceUpdate } from '../../hooks/useConfluenceUpdate';
import { UpdateFormValues } from '../../types/confluence';

const { Title, Paragraph } = Typography;

const ConfluenceUpdater: React.FC = () => {
  const { loading, result, updatePage, resetResult } = useConfluenceUpdate();

  const handleFormSubmit = (values: UpdateFormValues) => {
    updatePage(values);
  };

  const handleFormReset = () => {
    resetResult();
  };

  return (
    <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
      <Card>
        <Title level={2}>
          <CalendarOutlined /> Confluence Page Updater
        </Title>

        <Paragraph>
          Update Confluence pages with multiple types of content using the proven Python script backend.
          This tool can update release dates, Jira ticket references, predecessor baseline URLs, repository baseline URLs, commit information, tags, branches,
          binary paths, Tool Release Info links (MEA, ADM, Restbus), and INT Test links (Communication, SW Version, Force calibration, memory report)
          with precise pattern matching through the Bosch proxy.
        </Paragraph>

        <Alert
          message="Server Requirement"
          description="Make sure the update server is running on port 3002 with the new multi-update API endpoint"
          type="info"
          style={{ marginBottom: 16 }}
          showIcon
        />

        <Divider />

        <ConfluenceForm
          onFinish={handleFormSubmit}
          loading={loading}
          onReset={handleFormReset}
        />

        {result && (
          <>
            <Divider />
            <UpdateResults result={result} />
          </>
        )}

        <Divider />

        <ConfluenceInstructions />
      </Card>

      <LoadingOverlay loading={loading} />
    </div>
  );
};

export default ConfluenceUpdater;