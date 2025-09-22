const http = require('http');
const https = require('https');
const url = require('url');

const PORT = 3001;
const CONFLUENCE_BASE_URL = 'https://inside-docupedia.bosch.com/confluence';
const CONFLUENCE_PAT = "MzEyNTMxNTkwMjQ4OkuYP1fwScED9vGXzXCSLkdIqx+/";

// Helper function to make HTTPS requests
function makeRequest(requestUrl, options = {}) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(requestUrl);

    const requestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 443,
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'GET',
      headers: {
        'Authorization': `Bearer ${CONFLUENCE_PAT}`,
        'Content-Type': 'application/json',
        'X-Atlassian-Token': 'no-check',
        'User-Agent': 'ConfluenceCopyTool/1.0',
        ...options.headers
      }
    };

    if (options.body) {
      requestOptions.headers['Content-Length'] = Buffer.byteLength(options.body);
    }

    const req = https.request(requestOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: data
        });
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(options.body);
    }

    req.end();
  });
}

// Parse URL path to extract space and title
function parseConfluenceUrl(confluenceUrl) {
  const parts = confluenceUrl.split('/');
  const displayIndex = parts.indexOf('display');
  if (displayIndex === -1 || displayIndex + 2 >= parts.length) {
    throw new Error('Invalid Confluence URL format');
  }

  const spaceKey = parts[displayIndex + 1];
  const titlePart = parts[displayIndex + 2];
  const title = decodeURIComponent(titlePart.replace(/\+/g, ' '));

  return { spaceKey, title };
}

const server = http.createServer(async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);

  try {
    if (parsedUrl.pathname === '/api/copy-page' && req.method === 'POST') {
      // Handle copy page request
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const { sourceUrl, parentUrl, targetSpaceKey, newTitle } = JSON.parse(body);

          console.log('Copy page request:', { sourceUrl, targetSpaceKey, newTitle });

          // Get source page
          const { spaceKey: sourceSpaceKey, title: sourceTitle } = parseConfluenceUrl(sourceUrl);

          const sourceResponse = await makeRequest(
            `${CONFLUENCE_BASE_URL}/rest/api/content?spaceKey=${sourceSpaceKey}&title=${encodeURIComponent(sourceTitle)}&expand=body.storage`
          );

          if (sourceResponse.status !== 200) {
            throw new Error(`Failed to get source page: ${sourceResponse.status}`);
          }

          const sourceData = JSON.parse(sourceResponse.data);
          const sourcePage = sourceData.results[0];

          if (!sourcePage) {
            throw new Error('Source page not found');
          }

          // Get parent page if specified
          let parentId = null;
          if (parentUrl) {
            const { spaceKey: parentSpaceKey, title: parentTitle } = parseConfluenceUrl(parentUrl);

            const parentResponse = await makeRequest(
              `${CONFLUENCE_BASE_URL}/rest/api/content?spaceKey=${parentSpaceKey}&title=${encodeURIComponent(parentTitle)}`
            );

            if (parentResponse.status === 200) {
              const parentData = JSON.parse(parentResponse.data);
              if (parentData.results[0]) {
                parentId = parentData.results[0].id;
              }
            }
          }

          // Create new page
          const pageData = {
            type: "page",
            title: newTitle,
            space: { key: targetSpaceKey },
            body: {
              storage: {
                value: sourcePage.body.storage.value,
                representation: "storage"
              }
            }
          };

          if (parentId) {
            pageData.ancestors = [{ id: parentId }];
          }

          const createResponse = await makeRequest(
            `${CONFLUENCE_BASE_URL}/rest/api/content`,
            {
              method: 'POST',
              body: JSON.stringify(pageData)
            }
          );

          if (createResponse.status !== 200) {
            throw new Error(`Failed to create page: ${createResponse.status} - ${createResponse.data}`);
          }

          const newPage = JSON.parse(createResponse.data);
          console.log('Page created successfully:', newPage.id);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(newPage));

        } catch (error) {
          console.error('Copy page error:', error);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: error.message }));
        }
      });

    } else if (parsedUrl.pathname === '/api/get-page' && req.method === 'POST') {
      // Handle get page request
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const { spaceKey, title } = JSON.parse(body);

          console.log('Get page request:', { spaceKey, title });

          const pageResponse = await makeRequest(
            `${CONFLUENCE_BASE_URL}/rest/api/content?spaceKey=${spaceKey}&title=${encodeURIComponent(title)}&expand=body.storage,space,version`
          );

          if (pageResponse.status !== 200) {
            console.log('Page response data:', pageResponse.data);
            throw new Error(`Failed to get page: ${pageResponse.status} - ${pageResponse.data}`);
          }

          const pageData = JSON.parse(pageResponse.data);
          const page = pageData.results[0];

          if (!page) {
            throw new Error('Page not found');
          }

          console.log('Page retrieved successfully:', page.id);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(page));

        } catch (error) {
          console.error('Get page error:', error);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: error.message }));
        }
      });

    } else if (parsedUrl.pathname.startsWith('/api/confluence/')) {
      // Proxy other Confluence API calls
      const confluencePath = parsedUrl.pathname.replace('/api/confluence', '');
      const fullUrl = `${CONFLUENCE_BASE_URL}${confluencePath}${parsedUrl.search || ''}`;

      let body = '';
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        req.on('data', chunk => body += chunk);
      }

      req.on('end', async () => {
        try {
          const response = await makeRequest(fullUrl, {
            method: req.method,
            body: body || undefined
          });

          res.writeHead(response.status, { 'Content-Type': 'application/json' });
          res.end(response.data);

        } catch (error) {
          console.error('Proxy error:', error);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: error.message }));
        }
      });

    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
    }

  } catch (error) {
    console.error('Server error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: error.message }));
  }
});

server.listen(PORT, () => {
  console.log(`🚀 Simple Confluence backend running on http://localhost:${PORT}`);
  console.log('   Copy page endpoint: POST /api/copy-page');
  console.log('   Get page endpoint: POST /api/get-page');
  console.log('   Confluence proxy: /api/confluence/*');
  console.log('   No external dependencies required!');
});