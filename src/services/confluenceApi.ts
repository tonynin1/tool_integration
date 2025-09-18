const CONFLUENCE_BASE_URL = 'https://inside-docupedia.bosch.com/confluence';
const CONFLUENCE_PAT = "MzEyNTMxNTkwMjQ4OkuYP1fwScED9vGXzXCSLkdIqx+/";

const confluenceHeaders = {
  'Authorization': `Bearer ${CONFLUENCE_PAT}`,
  'Content-Type': 'application/json'
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
    const response = await fetch(url, {
      ...options,
      headers: {
        ...confluenceHeaders,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    return response.json();
  }

  private extractSpaceAndTitle(url: string) {
    // Extract from URL like: /confluence/display/EBR/OD+CHERY+T28+EU+BL05+RC6.1
    const urlPath = url.replace(CONFLUENCE_BASE_URL, '');
    const parts = urlPath.split('/');
    const spaceKey = parts[3]; // EBR
    const titlePart = parts[4]; // OD+CHERY+T28+EU+BL05+RC6.1
    const title = decodeURIComponent(titlePart.replace(/\+/g, ' '));

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

  async testWritePermission(spaceKey: string): Promise<boolean> {
    const testPageData = {
      type: "page",
      title: `Test Page - ${Date.now()}`,
      space: { key: spaceKey },
      body: {
        storage: {
          value: "<p>Test page for write permission check. Will be deleted immediately.</p>",
          representation: "storage"
        }
      }
    };

    try {
      const result = await this.confluenceFetch(
        `${CONFLUENCE_BASE_URL}/rest/api/content`,
        {
          method: 'POST',
          body: JSON.stringify(testPageData)
        }
      );

      // Clean up - delete test page
      await this.confluenceFetch(
        `${CONFLUENCE_BASE_URL}/rest/api/content/${result.id}`,
        { method: 'DELETE' }
      );

      return true;
    } catch (error) {
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