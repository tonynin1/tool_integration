const http = require('http');

const PORT = 3002;

// Simple endpoint for updating Confluence dates
const server = http.createServer(async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url === '/api/update-date') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { pageUrl, pageId, newDate } = JSON.parse(body);

        // Support both pageUrl (new) and pageId (legacy)
        const pageInput = pageUrl || pageId;

        if (!pageInput) {
          throw new Error('Either pageUrl or pageId must be provided');
        }

        console.log(`📅 Update request: ${pageInput} → ${newDate}`);

        // Use the Python script that we know works
        const { spawn } = require('child_process');

        const pythonProcess = spawn('python3', [
          '/home/vvo8hc/DaiViet/tool_int/update_gwm_precise.py',
          pageInput,
          newDate
        ]);

        let output = '';
        let errorOutput = '';

        pythonProcess.stdout.on('data', (data) => {
          output += data.toString();
          console.log(data.toString().trim());
        });

        pythonProcess.stderr.on('data', (data) => {
          errorOutput += data.toString();
          console.error(data.toString().trim());
        });

        pythonProcess.on('close', (code) => {
          if (code === 0) {
            // Success - parse output for details
            const lines = output.split('\n');
            let oldDate = null;
            let pageTitle = null;
            let version = null;

            for (const line of lines) {
              if (line.includes('Found current date:')) {
                const match = line.match(/Found current date: (.+?),/);
                if (match) oldDate = match[1];
              }
              if (line.includes('Page updated to version')) {
                const match = line.match(/version (\d+)/);
                if (match) version = parseInt(match[1]);
              }
              if (line.includes('Page:')) {
                const match = line.match(/Page: (.+)/);
                if (match) pageTitle = match[1];
              }
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              success: true,
              message: 'Release date updated successfully',
              oldDate: oldDate,
              newDate: newDate,
              pageTitle: pageTitle,
              version: version,
              output: output
            }));
          } else {
            // Error
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              success: false,
              message: errorOutput || output || 'Update failed',
              output: output,
              errorOutput: errorOutput
            }));
          }
        });

      } catch (error) {
        console.error('❌ Server error:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          message: error.message
        }));
      }
    });
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

server.listen(PORT, () => {
  console.log(`🚀 Simple date update server running on http://localhost:${PORT}`);
  console.log('   Endpoint: POST /api/update-date');
  console.log('   Uses the proven Python script backend');
});

module.exports = server;