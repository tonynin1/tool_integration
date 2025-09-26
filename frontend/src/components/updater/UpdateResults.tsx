import React from 'react';
import { Alert } from 'antd';
import {
  CheckCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { UpdateResult } from '../../types';

interface UpdateResultsProps {
  result: UpdateResult | null;
}

const UpdateResults: React.FC<UpdateResultsProps> = ({ result }) => {
  if (!result) {
    return null;
  }

  if (result.success) {
    return (
      <Alert
        message="Update Successful"
        description={
          <div>
            <p><strong>Page:</strong> {result.pageTitle}</p>
            {result.oldDate && result.newDate && (
              <>
                <p><strong>Previous Date:</strong> {result.oldDate}</p>
                <p><strong>New Date:</strong> {result.newDate}</p>
              </>
            )}
            {result.oldJiraKey && result.newJiraKey && (
              <>
                <p><strong>Previous Jira Key:</strong> {result.oldJiraKey}</p>
                <p><strong>New Jira Key:</strong> {result.newJiraKey}</p>
              </>
            )}
            {result.oldBaselineUrl && result.newBaselineUrl && (
              <>
                <p><strong>Previous Predecessor Baseline:</strong> {result.oldBaselineUrl}</p>
                <p><strong>New Predecessor Baseline:</strong> {result.newBaselineUrl}</p>
                {result.newBaselineText && <p><strong>Baseline Text:</strong> {result.newBaselineText}</p>}
              </>
            )}
            {result.oldRepoBaselineUrl && result.newRepoBaselineUrl && (
              <>
                <p><strong>Previous Repository Baseline:</strong> {result.oldRepoBaselineUrl}</p>
                <p><strong>New Repository Baseline:</strong> {result.newRepoBaselineUrl}</p>
              </>
            )}
            <p><strong>New Version:</strong> {result.version}</p>
          </div>
        }
        type="success"
        icon={<CheckCircleOutlined />}
        showIcon
      />
    );
  } else {
    return (
      <Alert
        message="Update Failed"
        description={result.message}
        type="error"
        icon={<ExclamationCircleOutlined />}
        showIcon
      />
    );
  }
};

export default UpdateResults;