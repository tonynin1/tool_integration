const http = require('http');
const https = require('https');
const url = require('url');
const { spawn } = require('child_process');

const PORT = 3002; // Use 3002 as the main port for the combined server
const CONFLUENCE_BASE_URL = 'https://inside-docupedia.bosch.com/confluence';
const CONFLUENCE_PAT = "MzEyNTMxNTkwMjQ4OkuYP1fwScED9vGXzXCSLkdIqx+/";

// Helper function to extract commit ID from commit URL
function extractCommitIdFromUrl(commitUrl) {
  // Extract commit ID from URLs like: https://sourcecode06.dev.bosch.com/projects/G3N/repos/fvg3_lfs/commits/abc123def456...
  const commitMatch = commitUrl.match(/\/commits\/([a-f0-9]{40})/);
  return commitMatch ? commitMatch[1] : null;
}

// Helper function to extract tag name from tag URL
function extractTagNameFromUrl(tagUrl) {
  // Extract tag name from URLs like: https://sourcecode06.dev.bosch.com/projects/G3N/repos/fvg3_lfs/commits?until=GWM_FVE0120_BL02_V8.1
  const tagMatch = tagUrl.match(/until=([^&]+)$/);
  if (tagMatch) {
    return decodeURIComponent(tagMatch[1]);
  }
  return null;
}

// Helper function to extract branch name from branch URL
function extractBranchNameFromUrl(branchUrl) {
  // Extract branch name from URLs like: https://sourcecode06.dev.bosch.com/projects/G3N/repos/fvg3_lfs/commits?until=refs%2Fheads%2Frelease%2FCNGWM_FVE0120_BL02_V8.1
  const branchMatch = branchUrl.match(/until=refs%2Fheads%2F(.+)$/);
  if (branchMatch) {
    const branchPath = decodeURIComponent(branchMatch[1]);
    return `release/${branchPath.split('/').pop()}`; // Extract just the final part for release/X format
  }
  return null;
}

// Helper function to make HTTPS requests (from simple-server.js)
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

// Parse URL path to extract space and title (from simple-server.js)
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
    // =============================================================================
    // PAGE UPDATE ENDPOINTS (from update-date-simple.js)
    // =============================================================================
    if (req.method === 'POST' && (req.url === '/api/update-date' || req.url === '/api/update-page')) {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const { pageUrl, pageId, newDate, newJiraKey, newBaselineUrl, newRepoBaselineUrl, newCommitId, newCommitUrl, newTagUrl, newBranchUrl, toolLinks, intTestLinks, binaryPath } = JSON.parse(body);

          // Support both pageUrl (new) and pageId (legacy)
          const pageInput = pageUrl || pageId;

          if (!pageInput) {
            throw new Error('Either pageUrl or pageId must be provided');
          }

          // Build Python script arguments based on what's provided
          const args = ['./update_gwm_precise_refactored.py', pageInput];
          let actualCommitId = newCommitId;
          let extractedTagName = null;
          let extractedBranchName = null;

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
              updateTypes.push(`predecessor baseline: ${newBaselineUrl}`);
            }

            if (newRepoBaselineUrl) {
              args.push('--repo-baseline', newRepoBaselineUrl);
              updateTypes.push(`repository baseline: ${newRepoBaselineUrl}`);
            }

            // Handle commit URL - extract commit ID if needed
            if (newCommitUrl && !newCommitId) {
              actualCommitId = extractCommitIdFromUrl(newCommitUrl);
              if (!actualCommitId) {
                throw new Error('Could not extract commit ID from commit URL. Please ensure URL contains a valid 40-character commit hash.');
              }
            }

            if (actualCommitId && newCommitUrl) {
              args.push('--commit', actualCommitId, newCommitUrl);
              updateTypes.push(`commit: ${actualCommitId}`);
            } else if (newCommitUrl && !actualCommitId) {
              throw new Error('Invalid commit URL format. Could not extract commit ID.');
            }

            // Handle tag information - extract name from URL
            if (newTagUrl) {
              extractedTagName = extractTagNameFromUrl(newTagUrl);
              if (!extractedTagName) {
                throw new Error('Could not extract tag name from tag URL. Please ensure URL contains "until=" parameter.');
              }
              args.push('--tag', extractedTagName, newTagUrl);
              updateTypes.push(`tag: ${extractedTagName}`);
            }

            // Handle branch information - extract name from URL
            if (newBranchUrl) {
              extractedBranchName = extractBranchNameFromUrl(newBranchUrl);
              if (!extractedBranchName) {
                throw new Error('Could not extract branch name from branch URL. Please ensure URL contains "until=refs%2Fheads%2F" parameter.');
              }
              args.push('--branch', extractedBranchName, newBranchUrl);
              updateTypes.push(`branch: ${extractedBranchName}`);
            }

            // Handle tool links
            if (toolLinks) {
              args.push('--tool-links', toolLinks);
              updateTypes.push(`tool links: ${toolLinks}`);
            }

            // Handle INT test links
            if (intTestLinks) {
              args.push('--int-test-links', intTestLinks);
              updateTypes.push(`INT test links: ${intTestLinks}`);
            }

            // Handle binary path
            if (binaryPath) {
              args.push('--binary-path', binaryPath);
              updateTypes.push(`binary path: ${binaryPath}`);
            }

            if (updateTypes.length === 0) {
              throw new Error('At least one update field must be provided (newDate, newJiraKey, newBaselineUrl, newRepoBaselineUrl, newCommitUrl, tag, branch, toolLinks, intTestLinks, or binaryPath)');
            }

            console.log(`🔄 Multi-update request: ${pageInput} → ${updateTypes.join(', ')}`);
          }

          // Use the Python script that we know works
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
              let oldRepoBaselineUrl = null;
              let oldCommitId = null;
              let oldTagName = null;
              let oldBranchName = null;
              let toolLinksUpdated = false;
              let intTestLinksUpdated = false;
              let binaryPathUpdated = false;
              let oldBinaryPath = null;
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

                // Parse repository baseline changes
                if (line.includes('Repository baseline changed from:')) {
                  const match = line.match(/Repository baseline changed from: (.+?) → (.+)/);
                  if (match) oldRepoBaselineUrl = match[1];
                }

                // Parse commit changes
                if (line.includes('Commit changed from:')) {
                  const match = line.match(/Commit changed from: (.+?) → (.+)/);
                  if (match) oldCommitId = match[1];
                }

                // Parse tag changes
                if (line.includes('Tag changed from:')) {
                  const match = line.match(/Tag changed from: (.+?) → (.+)/);
                  if (match) oldTagName = match[1];
                }

                // Parse branch changes
                if (line.includes('Branch changed from:')) {
                  const match = line.match(/Branch changed from: (.+?) → (.+)/);
                  if (match) oldBranchName = match[1];
                }

                // Parse tool links updates
                if (line.includes('Tool Release Info links changed from:') || line.includes('Tool links update successful')) {
                  toolLinksUpdated = true;
                }

                // Parse INT test links updates
                if (line.includes('INT Test links changed from:') || line.includes('INT Test links update successful')) {
                  intTestLinksUpdated = true;
                }

                // Parse binary path updates
                if (line.includes('Binary path changed from:') || line.includes('Binary path update successful')) {
                  binaryPathUpdated = true;
                  const match = line.match(/Binary path changed from: (.+?) → (.+)/);
                  if (match) oldBinaryPath = match[1];
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
                if (newRepoBaselineUrl) updates.push('repository baseline');
                if (actualCommitId || newCommitUrl) updates.push('commit information');
                if (extractedTagName) updates.push('tag information');
                if (extractedBranchName) updates.push('branch information');
                if (toolLinksUpdated) updates.push('tool links');
                if (intTestLinksUpdated) updates.push('INT test links');
                if (binaryPathUpdated) updates.push('binary path');
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
                oldRepoBaselineUrl: oldRepoBaselineUrl,
                newRepoBaselineUrl: newRepoBaselineUrl,
                oldCommitId: oldCommitId,
                newCommitId: actualCommitId || newCommitId,
                newCommitUrl: newCommitUrl,
                oldTagName: oldTagName,
                newTagName: extractedTagName,
                newTagUrl: newTagUrl,
                oldBranchName: oldBranchName,
                newBranchName: extractedBranchName,
                newBranchUrl: newBranchUrl,
                toolLinksUpdated: toolLinksUpdated,
                toolLinksValue: toolLinks,
                intTestLinksUpdated: intTestLinksUpdated,
                intTestLinksValue: intTestLinks,
                binaryPathUpdated: binaryPathUpdated,
                binaryPathValue: binaryPath,
                oldBinaryPath: oldBinaryPath,
                newBinaryPath: binaryPath,
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

    // =============================================================================
    // CONFLUENCE API ENDPOINTS (from simple-server.js)
    // =============================================================================
    } else if (parsedUrl.pathname === '/api/copy-page' && req.method === 'POST') {
      // Handle copy page request
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const { sourceUrl, parentUrl, newTitle } = JSON.parse(body);

          console.log('📋 Copy page request:', { sourceUrl, newTitle });

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

          // Create new page in the same space as source
          const pageData = {
            type: "page",
            title: newTitle,
            space: { key: sourceSpaceKey },
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
          console.log('✅ Page created successfully:', newPage.id);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(newPage));

        } catch (error) {
          console.error('❌ Copy page error:', error);
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

          console.log('📖 Get page request:', { spaceKey, title });

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

          console.log('✅ Page retrieved successfully:', page.id);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(page));

        } catch (error) {
          console.error('❌ Get page error:', error);
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
          console.error('❌ Proxy error:', error);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: error.message }));
        }
      });

    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
    }

  } catch (error) {
    console.error('❌ Server error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: error.message }));
  }
});

server.listen(PORT, () => {
  console.log(`🚀 Combined Confluence server running on http://localhost:${PORT}`);
  console.log('');
  console.log('📝 Update Endpoints:');
  console.log('   - POST /api/update-date (legacy date-only updates)');
  console.log('   - POST /api/update-page (multi-field updates: date, Jira, predecessor baseline, repository baseline, commit, tag, branch, binary path, tool links, INT test links)');
  console.log('');
  console.log('📋 Confluence API Endpoints:');
  console.log('   - POST /api/copy-page (copy pages between spaces)');
  console.log('   - POST /api/get-page (retrieve page content)');
  console.log('   - * /api/confluence/* (proxy to Confluence REST API)');
  console.log('');
  console.log('🔧 Backend: Python script integration + Direct Confluence API');
  console.log('🌐 CORS: Enabled for all origins');
});

module.exports = server;