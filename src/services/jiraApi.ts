import axios, { AxiosResponse } from 'axios';
import { JiraTicket, JiraQueryParams, JiraApiPayload, JiraApiResponse, ExportResponse } from '../types/jira';

const API_BASE_URL = '/api/jira_tracker';

class JiraApiService {
  /**
   * Query tickets for a specific user
   */
  async queryTickets(params: JiraQueryParams): Promise<JiraTicket[]> {
    try {
      const payload: JiraApiPayload = {
        jira: {
          token: params.token,
          server: params.server,
          User: params.user,
          timeFrom: params.timeFrom,
          timeTo: params.timeTo,
          closeticket: params.includeClosedTickets
        }
      };

      const response: AxiosResponse<JiraApiResponse> = await axios.post(
        `${API_BASE_URL}/query`, 
        payload,
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      // Ensure we always return an array
      const responseData = response.data;
      
      // Check if response has a data property that's an array
      if (responseData.data && Array.isArray(responseData.data)) {
        return responseData.data;
      }
      
      // Check if the response itself is an array
      if (Array.isArray(responseData)) {
        return responseData;
      }
      
      // If response has tickets property
      if (responseData.tickets && Array.isArray(responseData.tickets)) {
        return responseData.tickets;
      }
      
      // Return empty array if no valid data found
      console.warn('No valid ticket array found in response:', responseData);
      return [];
    } catch (error: any) {
      console.error('Error querying Jira tickets:', error);
      
      if (error.response) {
        // Server responded with error status
        throw new Error(
          error.response.data?.msg || 
          `Server error: ${error.response.status}`
        );
      } else if (error.request) {
        // Network error
        throw new Error('Network error: Unable to connect to server');
      } else {
        // Other error
        throw new Error(`Request error: ${error.message}`);
      }
    }
  }

  /**
   * Export tickets to CSV/Excel
   */
  async exportTickets(params: JiraQueryParams): Promise<ExportResponse> {
    try {
      const payload: JiraApiPayload = {
        jira: {
          token: params.token,
          server: params.server,
          User: params.user,
          timeFrom: params.timeFrom,
          timeTo: params.timeTo,
          closeticket: params.includeClosedTickets
        }
      };

      const response: AxiosResponse<ExportResponse> = await axios.post(
        `${API_BASE_URL}/export`, 
        payload,
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('Error exporting Jira tickets:', error);
      throw new Error(
        error.response?.data?.msg || 
        'Failed to export tickets'
      );
    }
  }

  /**
   * Test connection to Jira
   */
  async testConnection(): Promise<string> {
    try {
      const response: AxiosResponse<string> = await axios.get(`${API_BASE_URL}/getquery`);
      return response.data;
    } catch (error: any) {
      console.error('Error testing connection:', error);
      throw new Error('Failed to test connection');
    }
  }
}

// Create instance and assign to variable before exporting
const jiraApiService = new JiraApiService();
export default jiraApiService;