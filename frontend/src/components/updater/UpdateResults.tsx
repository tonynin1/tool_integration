import React from 'react';
import { Alert, Divider, Typography } from 'antd';
import {
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ToolOutlined,
  ExperimentOutlined,
  FolderOutlined,
} from '@ant-design/icons';
import { UpdateResult } from '../../types/confluence';

const { Text } = Typography;

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
            {result.oldCommitId && result.newCommitId && (
              <>
                <p><strong>Previous Commit ID:</strong> {result.oldCommitId}</p>
                <p><strong>New Commit ID:</strong> {result.newCommitId}</p>
                {result.newCommitUrl && <p><strong>Commit URL:</strong> {result.newCommitUrl}</p>}
              </>
            )}
            {result.oldTagName && result.newTagName && (
              <>
                <p><strong>Previous Tag:</strong> {result.oldTagName}</p>
                <p><strong>New Tag:</strong> {result.newTagName}</p>
                {result.newTagUrl && <p><strong>Tag URL:</strong> {result.newTagUrl}</p>}
              </>
            )}
            {result.oldBranchName && result.newBranchName && (
              <>
                <p><strong>Previous Branch:</strong> {result.oldBranchName}</p>
                <p><strong>New Branch:</strong> {result.newBranchName}</p>
                {result.newBranchUrl && <p><strong>Branch URL:</strong> {result.newBranchUrl}</p>}
              </>
            )}
            {result.oldBinaryPath && result.newBinaryPath && (
              <>
                <p><strong>Previous Binary Path:</strong> {result.oldBinaryPath}</p>
                <p><strong>New Binary Path:</strong> {result.newBinaryPath}</p>
              </>
            )}
            {result.binaryPathUpdated && (
              <>
                <Divider orientation="left" plain>
                  <FolderOutlined /> Binary Path
                </Divider>
                <p><Text type="success">✅ Binary path updated successfully</Text></p>
                <p><strong>New Binary Path:</strong> {result.binaryPathValue}</p>
                <p><Text type="secondary">
                  Binary path in Release Info table updated
                </Text></p>
              </>
            )}
            {result.toolLinksUpdated && (
              <>
                <Divider orientation="left" plain>
                  <ToolOutlined /> Tool Release Info Links
                </Divider>
                <p><Text type="success">✅ Tool links updated successfully</Text></p>
                <p><strong>New Tool Links Path:</strong> {result.toolLinksValue}</p>
                <p><Text type="secondary">
                  • MEA: 2 links updated<br />
                  • ADM: 1 link updated<br />
                  • Restbus: 1 link updated
                </Text></p>
              </>
            )}
            {result.intTestLinksUpdated && (
              <>
                <Divider orientation="left" plain>
                  <ExperimentOutlined /> INT Test Links
                </Divider>
                <p><Text type="success">✅ INT Test links updated successfully</Text></p>
                <p><strong>New INT Test Links Path:</strong> {result.intTestLinksValue}</p>
                <p><Text type="secondary">
                  • Communication: Updated with \Int_test suffix<br />
                  • SW Version: Updated with \Int_test suffix<br />
                  • Force calibration: Updated with \Int_test suffix<br />
                  • Memory report: Updated with \Int_test suffix
                </Text></p>
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