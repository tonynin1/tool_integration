const CONFLUENCE_BASE_URL = 'https://inside-docupedia.bosch.com/confluence';
const CONFLUENCE_PAT = "MzEyNTMxNTkwMjQ4OkuYP1fwScED9vGXzXCSLkdIqx+/";

const confluenceHeaders = {
  'Authorization': `Bearer ${CONFLUENCE_PAT}`,
  'Content-Type': 'application/json'
};

async function confluenceFetch(url, options = {}) {
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

async function getAccessibleSpaces() {
  try {
    console.log('🔍 Fetching accessible Confluence spaces...\n');

    // Fetch spaces with pagination
    let allSpaces = [];
    let start = 0;
    const limit = 50;

    while (true) {
      const data = await confluenceFetch(
        `${CONFLUENCE_BASE_URL}/rest/api/space?start=${start}&limit=${limit}&expand=description.plain`
      );

      allSpaces = allSpaces.concat(data.results);

      if (data.results.length < limit) {
        break; // No more pages
      }

      start += limit;
    }

    console.log(`📊 Found ${allSpaces.length} accessible spaces:\n`);

    // Sort spaces by key for better readability
    allSpaces.sort((a, b) => a.key.localeCompare(b.key));

    return allSpaces;
  } catch (error) {
    console.error('❌ Error fetching spaces:', error.message);
    return [];
  }
}

async function testWritePermission(spaceKey) {
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
    const result = await confluenceFetch(
      `${CONFLUENCE_BASE_URL}/rest/api/content`,
      {
        method: 'POST',
        body: JSON.stringify(testPageData)
      }
    );

    // Clean up - delete test page
    await confluenceFetch(
      `${CONFLUENCE_BASE_URL}/rest/api/content/${result.id}`,
      { method: 'DELETE' }
    );

    return true;
  } catch (error) {
    return false;
  }
}

async function checkWritePermissions(spaces) {
  console.log('🔐 Checking write permissions (this may take a moment)...\n');

  const writableSpaces = [];
  const readOnlySpaces = [];

  // Check in batches to avoid overwhelming the server
  const batchSize = 5;
  for (let i = 0; i < spaces.length; i += batchSize) {
    const batch = spaces.slice(i, i + batchSize);

    const promises = batch.map(async (space) => {
      const canWrite = await testWritePermission(space.key);
      return { space, canWrite };
    });

    const results = await Promise.all(promises);

    results.forEach(({ space, canWrite }) => {
      if (canWrite) {
        writableSpaces.push(space);
      } else {
        readOnlySpaces.push(space);
      }
    });

    // Progress indicator
    console.log(`✅ Checked ${Math.min(i + batchSize, spaces.length)}/${spaces.length} spaces...`);
  }

  return { writableSpaces, readOnlySpaces };
}

async function main() {
  console.log('🚀 Confluence Space Accessibility Report\n');
  console.log('=' .repeat(50) + '\n');

  const spaces = await getAccessibleSpaces();

  if (spaces.length === 0) {
    console.log('❌ No spaces found or unable to access Confluence API');
    return;
  }

  const { writableSpaces, readOnlySpaces } = await checkWritePermissions(spaces);

  console.log('\n' + '=' .repeat(50));
  console.log('📝 WRITABLE SPACES (Target Space Options)');
  console.log('=' .repeat(50));

  if (writableSpaces.length === 0) {
    console.log('❌ No writable spaces found');
  } else {
    writableSpaces.forEach((space, index) => {
      console.log(`${index + 1}. ${space.key} - ${space.name}`);
      if (space.description?.plain?.value) {
        console.log(`   📄 ${space.description.plain.value.substring(0, 80)}${space.description.plain.value.length > 80 ? '...' : ''}`);
      }
      console.log('');
    });
  }

  console.log('=' .repeat(50));
  console.log('👀 READ-ONLY SPACES');
  console.log('=' .repeat(50));

  if (readOnlySpaces.length === 0) {
    console.log('✅ All spaces are writable');
  } else {
    readOnlySpaces.slice(0, 10).forEach((space, index) => {
      console.log(`${index + 1}. ${space.key} - ${space.name}`);
    });

    if (readOnlySpaces.length > 10) {
      console.log(`... and ${readOnlySpaces.length - 10} more read-only spaces`);
    }
  }

  console.log('\n' + '=' .repeat(50));
  console.log('📊 SUMMARY');
  console.log('=' .repeat(50));
  console.log(`📝 Writable spaces: ${writableSpaces.length}`);
  console.log(`👀 Read-only spaces: ${readOnlySpaces.length}`);
  console.log(`📊 Total accessible: ${spaces.length}`);

  if (writableSpaces.find(s => s.key === 'EBR')) {
    console.log('\n✅ EBR space is writable (recommended default)');
  } else {
    console.log('\n⚠️  EBR space is not writable or not found');
  }
}

main().catch(console.error);