const BASE_URL = 'https://inside-docupedia.bosch.com/confluence';
const PAT = "MzEyNTMxNTkwMjQ4OkuYP1fwScED9vGXzXCSLkdIqx+/"
const headers = {
    'Authorization': `Bearer ${PAT}`,
    'Content-Type': 'application/json'
};

async function checkEBRWritePermission() {
    console.log('🔍 Testing EBR Space Write Permission\n');
    console.log('=' .repeat(50));

    const spaceKey = 'EBR';

    try {
        // Step 1: Check if EBR space exists
        console.log('Step 1: Checking if EBR space exists...');
        const spaceResponse = await fetch(
            `${BASE_URL}/rest/api/space/${spaceKey}`,
            { headers }
        );

        if (!spaceResponse.ok) {
            console.log('❌ EBR space does not exist or is not accessible');
            console.log('Response status:', spaceResponse.status);
            const errorText = await spaceResponse.text();
            console.log('Error:', errorText);
            return;
        }

        const spaceInfo = await spaceResponse.json();
        console.log('✅ EBR space exists');
        console.log(`   Name: ${spaceInfo.name}`);
        console.log(`   Key: ${spaceInfo.key}`);
        console.log(`   Type: ${spaceInfo.type}`);

        // Step 2: Test write permission
        console.log('\nStep 2: Testing write permission...');

        const testPageData = {
            type: "page",
            title: `Write Permission Test - ${Date.now()}`,
            space: { key: spaceKey },
            body: {
                storage: {
                    value: "<p>This is a test page to verify write permissions. It will be deleted immediately after creation.</p>",
                    representation: "storage"
                }
            }
        };

        const createResponse = await fetch(
            `${BASE_URL}/rest/api/content`,
            {
                method: 'POST',
                headers,
                body: JSON.stringify(testPageData)
            }
        );

        if (!createResponse.ok) {
            console.log('❌ Write permission test FAILED');
            console.log('Response status:', createResponse.status);
            const errorText = await createResponse.text();
            console.log('Error details:', errorText);

            // Try to parse error for more details
            try {
                const errorJson = JSON.parse(errorText);
                if (errorJson.message) {
                    console.log('Error message:', errorJson.message);
                }
            } catch (e) {
                // Ignore JSON parse errors
            }

            console.log('\n🔍 Possible reasons:');
            console.log('- You may not have write permissions to the EBR space');
            console.log('- The space may be restricted');
            console.log('- There may be content restrictions in place');
            return;
        }

        const createdPage = await createResponse.json();
        console.log('✅ Write permission test PASSED');
        console.log(`   Created test page: ${createdPage.title}`);
        console.log(`   Page ID: ${createdPage.id}`);

        // Step 3: Clean up - delete the test page
        console.log('\nStep 3: Cleaning up test page...');

        const deleteResponse = await fetch(
            `${BASE_URL}/rest/api/content/${createdPage.id}`,
            {
                method: 'DELETE',
                headers
            }
        );

        if (deleteResponse.ok) {
            console.log('✅ Test page deleted successfully');
        } else {
            console.log('⚠️  Warning: Could not delete test page');
            console.log('   You may need to manually delete it from Confluence');
            console.log(`   Page URL: ${BASE_URL}${createdPage._links.webui}`);
        }

        console.log('\n' + '=' .repeat(50));
        console.log('🎉 RESULT: EBR space is WRITABLE');
        console.log('✅ You can use EBR as your Target Space');
        console.log('=' .repeat(50));

    } catch (error) {
        console.log('\n❌ Error occurred during testing:');
        console.log('Error:', error.message);

        console.log('\n🔍 Troubleshooting:');
        console.log('1. Check your network connection');
        console.log('2. Verify your authentication token is valid');
        console.log('3. Ensure you have access to the Confluence instance');
        console.log('4. Try accessing the EBR space manually in your browser');
    }
}

// Run the test
checkEBRWritePermission();