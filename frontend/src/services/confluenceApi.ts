const CONFLUENCE_BASE_URL = process.env.REACT_APP_CONFLUENCE_BASE_URL || '/confluence';
const CONFLUENCE_PAT = process.env.REACT_APP_CONFLUENCE_PAT || '';

const confluenceHeaders = {
  'Authorization': `Bearer ${CONFLUENCE_PAT}`,
  'Content-Type': 'application/json',
  'X-Atlassian-Token': 'no-check'
};

export interface ConfluencePageRequest {
  sourceUrl: string;
  parentUrl?: string;
  targetSpaceKey: string;
  newTitle: string;
}

export interface ConfluencePageResponse {
  id: string;
  title: string;
  type: string;
  status: string;
  space: {
    key: string;
    name: string;
  };
  body: {
    storage: {
      value: string;
      representation: string;
    };
  };
  _links: {
    webui: string;
  };
}

export interface ConfluenceSpace {
  key: string;
  name: string;
  description?: {
    plain: {
      value: string;
    };
  };
}

class ConfluenceApiService {
  private xsrfToken: string | null = null;

  private async getXsrfToken(): Promise<string> {
    try {
      // Get XSRF token by making a simple GET request to user endpoint
      const response = await fetch(`${CONFLUENCE_BASE_URL}/rest/api/user/current`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${CONFLUENCE_PAT}`,
          'Accept': 'application/json'
        },
        credentials: 'include'
      });

      // Check for XSRF token in response headers
      const xsrfFromHeader = response.headers.get('X-XSRF-Token') ||
                           response.headers.get('X-Atlassian-Token') ||
                           response.headers.get('X-AUSERNAME');

      if (xsrfFromHeader && xsrfFromHeader !== 'anonymous') {
        console.log('Found XSRF token in headers:', xsrfFromHeader);
        return xsrfFromHeader;
      }

      // If no token in headers, try to extract from Set-Cookie
      const setCookie = response.headers.get('set-cookie');
      if (setCookie) {
        const xsrfMatch = setCookie.match(/XSRF-TOKEN=([^;]+)/);
        if (xsrfMatch) {
          console.log('Found XSRF token in cookies:', xsrfMatch[1]);
          return xsrfMatch[1];
        }
      }

      console.log('No XSRF token found, using no-check');
      return 'no-check';
    } catch (error) {
      console.warn('Failed to get XSRF token:', error);
      return 'no-check';
    }
  }

  private async confluenceFetch(url: string, options: RequestInit = {}) {
    const isWriteOperation = options.method && ['POST', 'PUT', 'DELETE'].includes(options.method.toUpperCase());

    // Get fresh XSRF token for write operations
    if (isWriteOperation && !this.xsrfToken) {
      this.xsrfToken = await this.getXsrfToken();
    }

    const headers = {
      ...confluenceHeaders,
      ...options.headers,
    };

    // Use the obtained XSRF token for write operations
    if (isWriteOperation && this.xsrfToken) {
      headers['X-Atlassian-Token'] = this.xsrfToken;
    }

    const fetchOptions: RequestInit = {
      ...options,
      headers,
      credentials: 'include' // Include cookies for session management
    };

    console.log(`Confluence ${options.method || 'GET'} request:`, {
      url: url.replace(CONFLUENCE_BASE_URL, ''),
      hasXsrfToken: !!this.xsrfToken,
      xsrfToken: isWriteOperation ? this.xsrfToken : 'not needed'
    });

    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
      const errorText = await response.text();

      // If XSRF error, clear token and retry once
      if (response.status === 403 && errorText.includes('XSRF') && isWriteOperation && this.xsrfToken !== 'retried') {
        console.log('XSRF error, getting fresh token and retrying...');
        this.xsrfToken = null;
        this.xsrfToken = await this.getXsrfToken();

        // Retry with new token
        if (this.xsrfToken !== 'no-check') {
          const retryHeaders = { ...headers, 'X-Atlassian-Token': this.xsrfToken };
          const retryResponse = await fetch(url, { ...fetchOptions, headers: retryHeaders });

          if (retryResponse.ok) {
            return retryResponse.json();
          }
        }
      }

      console.error(`Confluence API error ${response.status}:`, errorText);
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    return response.json();
  }

  private extractSpaceAndTitle(url: string) {
    // Extract from URL like: https://inside-docupedia.bosch.com/confluence/display/EBR/OD+CHERY+T28+EU+BL05+RC6.1
    console.log('Extracting from URL:', url);

    if (!url.includes('/confluence/display/')) {
      throw new Error(`Invalid Confluence URL format. Expected format: https://inside-docupedia.bosch.com/confluence/display/SPACE/PageTitle but got: ${url}`);
    }

    // Find the position of '/display/' and extract from there
    const displayIndex = url.indexOf('/display/');
    const pathAfterDisplay = url.substring(displayIndex + '/display/'.length);
    const parts = pathAfterDisplay.split('/');

    console.log('Path after /display/:', pathAfterDisplay);
    console.log('Parts:', parts);

    if (parts.length < 2) {
      throw new Error(`URL does not contain space and title. Expected format: .../display/SPACE/TITLE but got: ${pathAfterDisplay}`);
    }

    const spaceKey = parts[0]; // EBR
    const titlePart = parts[1]; // GWM+FVE0120+BL02+V5

    if (!spaceKey || !titlePart) {
      throw new Error(`Could not extract space key or title from URL. Space: "${spaceKey}", Title: "${titlePart}"`);
    }

    const title = decodeURIComponent(titlePart.replace(/\+/g, ' '));

    console.log('Extracted - Space:', spaceKey, 'Title:', title);
    return { spaceKey, title };
  }

  async getPageByUrl(url: string): Promise<ConfluencePageResponse> {
    const { spaceKey, title } = this.extractSpaceAndTitle(url);

    const data = await this.confluenceFetch(
      `${CONFLUENCE_BASE_URL}/rest/api/content?spaceKey=${spaceKey}&title=${encodeURIComponent(title)}&expand=body.storage,space,version`
    );

    if (!data.results || data.results.length === 0) {
      throw new Error(`Page not found: ${title} in space ${spaceKey}`);
    }

    return data.results[0];
  }

  async createPage(spaceKey: string, title: string, content: string, parentId?: string): Promise<ConfluencePageResponse> {
    const pageData: any = {
      type: "page",
      title: title,
      space: {
        key: spaceKey
      },
      body: {
        storage: {
          value: content,
          representation: "storage"
        }
      }
    };

    if (parentId) {
      pageData.ancestors = [{ id: parentId }];
    }

    return this.confluenceFetch(
      `${CONFLUENCE_BASE_URL}/rest/api/content`,
      {
        method: 'POST',
        body: JSON.stringify(pageData)
      }
    );
  }

  async copyPage(request: ConfluencePageRequest): Promise<ConfluencePageResponse> {
    // Use backend API to avoid XSRF issues
    const response = await fetch('http://localhost:3001/api/copy-page', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  async getAccessibleSpaces(): Promise<ConfluenceSpace[]> {
    const data = await this.confluenceFetch(
      `${CONFLUENCE_BASE_URL}/rest/api/space?limit=100`
    );

    return data.results;
  }

  async getCurrentUser() {
    return this.confluenceFetch(
      `${CONFLUENCE_BASE_URL}/rest/api/user/current`
    );
  }

  async checkSpaceExists(spaceKey: string): Promise<boolean> {
    try {
      console.log(`Checking if space ${spaceKey} exists...`);
      const response = await this.confluenceFetch(
        `${CONFLUENCE_BASE_URL}/rest/api/space/${spaceKey}`
      );
      console.log(`Space ${spaceKey} exists:`, response);
      return true;
    } catch (error: any) {
      console.log(`Space ${spaceKey} check failed:`, error.message);
      return false;
    }
  }

  async testWritePermission(spaceKey: string): Promise<boolean> {
    try {
      // First, check if the space exists by trying to get its information
      const spaceResponse = await this.confluenceFetch(
        `${CONFLUENCE_BASE_URL}/rest/api/space/${spaceKey}`
      );

      if (!spaceResponse) {
        return false;
      }

      // Try a lightweight permission check first - get user permissions for the space
      try {
        await this.confluenceFetch(
          `${CONFLUENCE_BASE_URL}/rest/api/user/current`
        );
      } catch (userError) {
        // If we can't get current user, fall back to test page creation
      }

      // Test actual write permission with a test page
      const testPageData = {
        type: "page",
        title: `Permission Test - ${Date.now()}`,
        space: { key: spaceKey },
        body: {
          storage: {
            value: "<p>Permission test page - will be deleted immediately.</p>",
            representation: "storage"
          }
        }
      };

      const result = await this.confluenceFetch(
        `${CONFLUENCE_BASE_URL}/rest/api/content`,
        {
          method: 'POST',
          body: JSON.stringify(testPageData)
        }
      );

      // Clean up - delete test page immediately
      try {
        await this.confluenceFetch(
          `${CONFLUENCE_BASE_URL}/rest/api/content/${result.id}`,
          { method: 'DELETE' }
        );
      } catch (deleteError) {
        // Log delete error but don't fail the permission check
        console.warn('Failed to clean up test page:', deleteError);
      }

      return true;
    } catch (error: any) {
      console.log('Write permission check failed for space', spaceKey, ':', error.message);
      return false;
    }
  }

  extractTitleFromUrl(url: string): string {
    try {
      const parts = url.split('/');
      const titlePart = parts[parts.length - 1];
      return decodeURIComponent(titlePart.replace(/\+/g, ' '));
    } catch {
      return '';
    }
  }
}

export const confluenceApi = new ConfluenceApiService();