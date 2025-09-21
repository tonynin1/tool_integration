const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

const CONFLUENCE_BASE_URL = 'https://inside-docupedia.bosch.com/confluence';
const CONFLUENCE_PAT = "MzEyNTMxNTkwMjQ4OkuYP1fwScED9vGXzXCSLkdIqx+/";

const confluenceHeaders = {
  'Authorization': `Bearer ${CONFLUENCE_PAT}`,
  'Content-Type': 'application/json',
  'X-Atlassian-Token': 'no-check'
};

// Copy page endpoint
app.post('/api/copy-page', async (req, res) => {
  try {
    const { sourceUrl, parentUrl, targetSpaceKey, newTitle } = req.body;

    console.log('Copy page request:', { sourceUrl, targetSpaceKey, newTitle });

    // Get source page
    const sourceUrlParts = sourceUrl.split('/');
    const sourceSpaceKey = sourceUrlParts[sourceUrlParts.length - 2];
    const sourceTitle = decodeURIComponent(sourceUrlParts[sourceUrlParts.length - 1].replace(/\+/g, ' '));

    const sourceResponse = await fetch(
      `${CONFLUENCE_BASE_URL}/rest/api/content?spaceKey=${sourceSpaceKey}&title=${encodeURIComponent(sourceTitle)}&expand=body.storage`,
      { headers: confluenceHeaders }
    );

    if (!sourceResponse.ok) {
      throw new Error(`Failed to get source page: ${sourceResponse.status}`);
    }

    const sourceData = await sourceResponse.json();
    const sourcePage = sourceData.results[0];

    if (!sourcePage) {
      throw new Error('Source page not found');
    }

    // Get parent page if specified
    let parentId = null;
    if (parentUrl) {
      const parentUrlParts = parentUrl.split('/');
      const parentSpaceKey = parentUrlParts[parentUrlParts.length - 2];
      const parentTitle = decodeURIComponent(parentUrlParts[parentUrlParts.length - 1].replace(/\+/g, ' '));

      const parentResponse = await fetch(
        `${CONFLUENCE_BASE_URL}/rest/api/content?spaceKey=${parentSpaceKey}&title=${encodeURIComponent(parentTitle)}`,
        { headers: confluenceHeaders }
      );

      if (parentResponse.ok) {
        const parentData = await parentResponse.json();
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

    const createResponse = await fetch(
      `${CONFLUENCE_BASE_URL}/rest/api/content`,
      {
        method: 'POST',
        headers: confluenceHeaders,
        body: JSON.stringify(pageData)
      }
    );

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      throw new Error(`Failed to create page: ${createResponse.status} - ${errorText}`);
    }

    const newPage = await createResponse.json();
    console.log('Page created successfully:', newPage.id);

    res.json(newPage);
  } catch (error) {
    console.error('Copy page error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Proxy other Confluence API calls
app.all('/api/confluence/*', async (req, res) => {
  try {
    const path = req.path.replace('/api/confluence', '');
    const url = `${CONFLUENCE_BASE_URL}${path}${req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : ''}`;

    const response = await fetch(url, {
      method: req.method,
      headers: {
        ...confluenceHeaders,
        ...(req.body && { 'Content-Type': 'application/json' })
      },
      body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined
    });

    const data = await response.text();

    res.status(response.status);
    res.set('Content-Type', response.headers.get('content-type') || 'application/json');

    try {
      res.json(JSON.parse(data));
    } catch {
      res.send(data);
    }
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Confluence backend server running on http://localhost:${PORT}`);
  console.log('   Copy page endpoint: POST /api/copy-page');
  console.log('   Confluence proxy: /api/confluence/*');
});