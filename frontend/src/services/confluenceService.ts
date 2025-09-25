import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

export interface UpdateDateResponse {
  success: boolean;
  message: string;
  oldDate?: string;
  newDate?: string;
  pageTitle?: string;
  version?: number;
}

export interface ConfluencePage {
  id: string;
  title: string;
  version: number;
  content: string;
}

/**
 * Update the release date on a Confluence page
 */
export const updateConfluencePageDate = async (
  pageId: string,
  newDate: string
): Promise<UpdateDateResponse> => {
  try {
    const response = await api.post('/confluence/update-date', {
      pageId,
      newDate,
    });

    return response.data;
  } catch (error) {
    console.error('Error updating Confluence page date:', error);

    if (axios.isAxiosError(error)) {
      const message = error.response?.data?.message || error.message;
      return {
        success: false,
        message: `Failed to update page: ${message}`,
      };
    }

    return {
      success: false,
      message: 'Unknown error occurred while updating the page',
    };
  }
};

/**
 * Get Confluence page details
 */
export const getConfluencePage = async (pageId: string): Promise<ConfluencePage> => {
  try {
    const response = await api.get(`/confluence/page/${pageId}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching Confluence page:', error);
    throw error;
  }
};

/**
 * Search for Confluence pages
 */
export const searchConfluencePages = async (query: string) => {
  try {
    const response = await api.get('/confluence/search', {
      params: { q: query },
    });
    return response.data;
  } catch (error) {
    console.error('Error searching Confluence pages:', error);
    throw error;
  }
};