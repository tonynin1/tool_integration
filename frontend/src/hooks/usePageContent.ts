import { useState } from 'react';
import { notification } from 'antd';
import { PageContent, ApiResponse } from '../types/viewer';
import { API_ENDPOINTS, NOTIFICATION_DURATION } from '../constants/viewer';
import { useConfluenceValidation } from './useConfluenceValidation';

export const usePageContent = () => {
  const [loading, setLoading] = useState(false);
  const [pageContent, setPageContent] = useState<PageContent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { extractSpaceAndTitle } = useConfluenceValidation();

  const transformApiResponse = (apiData: ApiResponse): PageContent => ({
    id: apiData.id,
    title: apiData.title,
    content: apiData.body.storage.value,
    space: apiData.space.name,
    version: apiData.version.number,
    lastModified: apiData.version.when,
    author: apiData.version.by?.displayName || 'Unknown'
  });

  const fetchPage = async (pageUrl: string): Promise<void> => {
    if (!pageUrl?.trim()) {
      setError('Page URL is required');
      notification.error({
        message: 'Invalid Input',
        description: 'Please provide a valid Confluence page URL',
        duration: NOTIFICATION_DURATION.ERROR
      });
      return;
    }

    setLoading(true);
    setPageContent(null);
    setError(null);

    try {
      console.log('Fetching page:', pageUrl);

      const { spaceKey, title } = extractSpaceAndTitle(pageUrl);

      if (!spaceKey || !title) {
        throw new Error('Unable to extract space key and title from URL. Please check the URL format.');
      }

      const response = await fetch(API_ENDPOINTS.GET_PAGE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          spaceKey,
          title
        })
      });

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          // If error response is not JSON, use status message
        }
        throw new Error(errorMessage);
      }

      const pageData: ApiResponse = await response.json();

      if (!pageData || !pageData.id) {
        throw new Error('Invalid response from server');
      }

      const transformedContent = transformApiResponse(pageData);
      setPageContent(transformedContent);

      notification.success({
        message: 'Page loaded successfully!',
        description: `Loaded: ${transformedContent.title}`,
        duration: NOTIFICATION_DURATION.SUCCESS
      });

    } catch (error) {
      console.error('View page error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setError(errorMessage);

      notification.error({
        message: 'Failed to load page',
        description: errorMessage,
        duration: NOTIFICATION_DURATION.ERROR
      });
    } finally {
      setLoading(false);
    }
  };

  const refreshPage = async (pageUrl: string): Promise<void> => {
    await fetchPage(pageUrl);
  };

  const clearError = () => setError(null);

  return {
    loading,
    pageContent,
    error,
    fetchPage,
    refreshPage,
    clearError
  };
};