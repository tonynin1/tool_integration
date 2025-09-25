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

  if (req.method === 'POST' && (req.url === '/api/update-date' || req.url === '/api/update-page')) {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { pageUrl, pageId, newDate, newJiraKey, newBaselineUrl } = JSON.parse(body);

        // Support both pageUrl (new) and pageId (legacy)
        const pageInput = pageUrl || pageId;

        if (!pageInput) {
          throw new Error('Either pageUrl or pageId must be provided');
        }

        // Build Python script arguments based on what's provided
        const args = ['/home/vvo8hc/DaiViet/tool_int/update_gwm_precise.py', pageInput];

        // Determine update type and add appropriate arguments
        if (req.url === '/api/update-date') {
          // Legacy date-only endpoint
          if (!newDate) {
            throw new Error('newDate is required for /api/update-date endpoint');
          }
          args.push(newDate);
          console.log(`📅 Date update request: ${pageInput} → ${newDate}`);
        } else {
          // New multi-update endpoint
          let updateTypes = [];

          if (newDate) {
            args.push(newDate);
            updateTypes.push(`date: ${newDate}`);
          }

          if (newJiraKey) {
            args.push('--jira', newJiraKey);
            updateTypes.push(`Jira: ${newJiraKey}`);
          }

          if (newBaselineUrl) {
            args.push('--baseline', newBaselineUrl);
            updateTypes.push(`baseline: ${newBaselineUrl}`);
          }

          if (updateTypes.length === 0) {
            throw new Error('At least one update field must be provided (newDate, newJiraKey, or newBaselineUrl)');
          }

          console.log(`🔄 Multi-update request: ${pageInput} → ${updateTypes.join(', ')}`);
        }

        // Use the Python script that we know works
        const { spawn } = require('child_process');

        const pythonProcess = spawn('python3', args);

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
            let oldJiraKey = null;
            let oldBaselineUrl = null;
            let newBaselineText = null;
            let pageTitle = null;
            let version = null;

            for (const line of lines) {
              // Parse date changes
              if (line.includes('Found current date:')) {
                const match = line.match(/Found current date: (.+?),/);
                if (match) oldDate = match[1];
              }

              // Parse Jira changes
              if (line.includes('Jira key changed from:')) {
                const match = line.match(/Jira key changed from: (.+?) → (.+)/);
                if (match) oldJiraKey = match[1];
              }

              // Parse baseline changes
              if (line.includes('Predecessor baseline changed from:')) {
                const match = line.match(/Predecessor baseline changed from: (.+?) → (.+)/);
                if (match) oldBaselineUrl = match[1];
              }

              if (line.includes('Display text:')) {
                const match = line.match(/Display text: (.+)/);
                if (match) newBaselineText = match[1];
              }

              // Parse general info
              if (line.includes('Page updated to version')) {
                const match = line.match(/version (\d+)/);
                if (match) version = parseInt(match[1]);
              }
              if (line.includes('Page:')) {
                const match = line.match(/Page: (.+)/);
                if (match) pageTitle = match[1];
              }
            }

            // Build response message based on what was updated
            let message = 'Page updated successfully';
            if (req.url === '/api/update-date') {
              message = 'Release date updated successfully';
            } else {
              let updates = [];
              if (newDate) updates.push('release date');
              if (newJiraKey) updates.push('Jira key');
              if (newBaselineUrl) updates.push('predecessor baseline');
              message = `Updated: ${updates.join(', ')}`;
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              success: true,
              message: message,
              oldDate: oldDate,
              newDate: newDate,
              oldJiraKey: oldJiraKey,
              newJiraKey: newJiraKey,
              oldBaselineUrl: oldBaselineUrl,
              newBaselineUrl: newBaselineUrl,
              newBaselineText: newBaselineText,
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
  console.log(`🚀 Confluence update server running on http://localhost:${PORT}`);
  console.log('   Endpoints:');
  console.log('   - POST /api/update-date (legacy date-only updates)');
  console.log('   - POST /api/update-page (multi-field updates: date, Jira, baseline)');
  console.log('   Uses the proven Python script backend');
});

module.exports = server;