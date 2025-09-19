const CONFLUENCE_BASE_URL = process.env.REACT_APP_CONFLUENCE_BASE_URL || '/confluence';
const CONFLUENCE_PAT = process.env.REACT_APP_CONFLUENCE_PAT || '';
const PROXY_SERVER = process.env.REACT_APP_PROXY_SERVER || '';

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
  private async confluenceFetch(url: string, options: RequestInit = {}) {
    // Add proxy configuration for cross-origin requests
    const fetchOptions: RequestInit = {
      ...options,
      headers: {
        ...confluenceHeaders,
        ...options.headers,
      },
      mode: 'cors',
      credentials: 'omit'
    };

    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
      const errorText = await response.text();
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
    // Step 1: Get source page content
    const sourcePage = await this.getPageByUrl(request.sourceUrl);

    // Step 2: Get parent page ID if parent URL provided
    let parentId: string | undefined;
    if (request.parentUrl) {
      const parentPage = await this.getPageByUrl(request.parentUrl);
      parentId = parentPage.id;
    }

    // Step 3: Create new page with copied content
    const newPage = await this.createPage(
      request.targetSpaceKey,
      request.newTitle,
      sourcePage.body.storage.value,
      parentId
    );

    return newPage;
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