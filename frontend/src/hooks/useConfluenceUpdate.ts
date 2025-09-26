import { useState } from 'react';
import { message } from 'antd';
import axios from 'axios';
import { format } from 'date-fns';
import { UpdateResult, UpdateFormValues, UpdatePayload } from '../types/confluence';

export const useConfluenceUpdate = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<UpdateResult | null>(null);

  const updatePage = async (values: UpdateFormValues) => {
    setLoading(true);
    setResult(null);

    try {
      // Prepare the request payload
      const payload: UpdatePayload = {
        pageUrl: values.pageUrl,
      };

      // Add date if provided
      if (values.newDate) {
        payload.newDate = format(values.newDate.toDate(), 'yyyy-MM-dd');
      }

      // Add Jira key if provided
      if (values.newJiraKey) {
        payload.newJiraKey = values.newJiraKey.trim();
      }

      // Add baseline URL if provided
      if (values.newBaselineUrl) {
        payload.newBaselineUrl = values.newBaselineUrl.trim();
      }

      // Add repository baseline URL if provided
      if (values.newRepoBaselineUrl) {
        payload.newRepoBaselineUrl = values.newRepoBaselineUrl.trim();
      }

      // Add commit URL if provided
      if (values.newCommitUrl) {
        payload.newCommitUrl = values.newCommitUrl.trim();
      }

      // Add tag URL if provided (name will be extracted on backend)
      if (values.newTagUrl) {
        payload.newTagUrl = values.newTagUrl.trim();
      }

      // Add branch URL if provided (name will be extracted on backend)
      if (values.newBranchUrl) {
        payload.newBranchUrl = values.newBranchUrl.trim();
      }

      message.loading('Updating Confluence page via Python script...', 0);

      // Call the simple Node.js server that runs the Python script
      const response = await axios.post('http://localhost:3002/api/update-page', payload, {
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
          oldJiraKey: response.data.oldJiraKey,
          newJiraKey: response.data.newJiraKey,
          oldBaselineUrl: response.data.oldBaselineUrl,
          newBaselineUrl: response.data.newBaselineUrl,
          newBaselineText: response.data.newBaselineText,
          oldRepoBaselineUrl: response.data.oldRepoBaselineUrl,
          newRepoBaselineUrl: response.data.newRepoBaselineUrl,
          oldCommitId: response.data.oldCommitId,
          newCommitId: response.data.newCommitId,
          newCommitUrl: response.data.newCommitUrl,
          oldTagName: response.data.oldTagName,
          newTagName: response.data.newTagName,
          newTagUrl: response.data.newTagUrl,
          oldBranchName: response.data.oldBranchName,
          newBranchName: response.data.newBranchName,
          newBranchUrl: response.data.newBranchUrl,
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

  const resetResult = () => {
    setResult(null);
  };

  return {
    loading,
    result,
    updatePage,
    resetResult,
  };
};