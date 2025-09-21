const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch'); // You may need: npm install node-fetch@2

const app = express();
const PORT = 3001;

// Enable CORS for all routes
app.use(cors());
app.use(express.json());

const CONFLUENCE_BASE_URL = 'https://inside-docupedia.bosch.com/confluence';
const CONFLUENCE_PAT = "MzEyNTMxNTkwMjQ4OkuYP1fwScED9vGXzXCSLkdIqx+/";

const confluenceHeaders = {
  'Authorization': `Bearer ${CONFLUENCE_PAT}`,
  'Content-Type': 'application/json'
};

// Proxy all /api/confluence requests
app.all('/api/confluence/*', async (req, res) => {
  try {
    const confluencePath = req.path.replace('/api/confluence', '');
    const url = `${CONFLUENCE_BASE_URL}${confluencePath}${req.url.includes('?') ? '&' + req.url.split('?')[1] : ''}`;

    console.log(`Proxying ${req.method} ${url}`);

    const response = await fetch(url, {
      method: req.method,
      headers: {
        ...confluenceHeaders,
        ...req.headers,
        'host': undefined,
        'origin': undefined,
        'referer': undefined
      },
      body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined
    });

    const data = await response.text();

    res.status(response.status);

    // Copy relevant headers
    ['content-type', 'cache-control', 'etag'].forEach(header => {
      if (response.headers.get(header)) {
        res.set(header, response.headers.get(header));
      }
    });

    // Try to parse as JSON, fall back to text
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
  console.log(`🚀 Confluence proxy server running on http://localhost:${PORT}`);
  console.log(`   Proxying requests to: ${CONFLUENCE_BASE_URL}`);
  console.log('   React app should use: http://localhost:3001/api/confluence');
});