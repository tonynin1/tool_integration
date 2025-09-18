const BASE_URL = 'https://inside-docupedia.bosch.com/confluence';
const PAT = "MzEyNTMxNTkwMjQ4OkuYP1fwScED9vGXzXCSLkdIqx+/"
const headers = {
    'Authorization': `Bearer ${PAT}`,
    'Content-Type': 'application/json'
};

// Test current user and permissions
async function testCurrentUser() {
    console.log('Testing authentication...');
    const response = await fetch(
        `${BASE_URL}/rest/api/user/current`,
        { headers }
    );

    console.log('Current user response status:', response.status);

    if (response.ok) {
        const user = await response.json();
        console.log('✅ Authentication successful!');
        console.log('Current user:', user.displayName);
        console.log('User key:', user.userKey);
        console.log('Email:', user.email);

        // Try to get spaces this user can access
        await getUserSpaces();
    } else {
        console.error('❌ Authentication failed:', response.status);
        const errorText = await response.text();
        console.error('Error details:', errorText);
    }
}

async function getUserSpaces() {
    console.log('\nGetting accessible spaces...');
    const response = await fetch(
        `${BASE_URL}/rest/api/space?limit=50`,
        { headers }
    );

    if (response.ok) {
        const data = await response.json();
        console.log('\n📂 Spaces you have access to:');
        data.results.forEach(space => {
            console.log(`  - ${space.key}: ${space.name}`);
        });

        // Test write permissions on first few spaces
        console.log('\n🔍 Testing write permissions...');
        for (let i = 0; i < Math.min(3, data.results.length); i++) {
            await testWritePermission(data.results[i].key);
        }
    } else {
        console.error('Failed to get spaces:', response.status);
        const errorText = await response.text();
        console.error('Error details:', errorText);
    }
}

async function testWritePermission(spaceKey) {
    const testPageData = {
        type: "page",
        title: `Test Page - ${Date.now()}`,
        space: {
            key: spaceKey
        },
        body: {
            storage: {
                value: "<p>This is a test page to check write permissions. Will be deleted immediately.</p>",
                representation: "storage"
            }
        }
    };

    const response = await fetch(
        `${BASE_URL}/rest/api/content`,
        {
            method: 'POST',
            headers,
            body: JSON.stringify(testPageData)
        }
    );

    if (response.ok) {
        const result = await response.json();
        console.log(`  ✅ ${spaceKey}: Write permission OK`);

        // Delete the test page immediately
        await deleteTestPage(result.id);
    } else {
        console.log(`  ❌ ${spaceKey}: No write permission (${response.status})`);
    }
}

async function deleteTestPage(pageId) {
    await fetch(
        `${BASE_URL}/rest/api/content/${pageId}`,
        {
            method: 'DELETE',
            headers
        }
    );
}

// Run the test
testCurrentUser()
.catch(error => {
    console.error('Test failed:', error.message);
});