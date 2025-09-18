const BASE_URL = 'https://inside-docupedia.bosch.com/confluence';
const PAT = "MzEyNTMxNTkwMjQ4OkuYP1fwScED9vGXzXCSLkdIqx+/"
// const PAT = "ODc4NDc0MTM3OTUxOq02LYqyDHqa04oDhvG2NiWF3fMG"
const headers = {
    'Authorization': `Bearer ${PAT}`,
    'Content-Type': 'application/json'
};

async function getPageBySpaceAndTitle(spaceKey, title) {
    const encodedTitle = encodeURIComponent(title);
    const response = await fetch(
        `${BASE_URL}/rest/api/content?spaceKey=${spaceKey}&title=${encodedTitle}&expand=body.storage,space,version`,
        { headers }
    );
    const data = await response.json();
    console.log('Response status:', response.status);

    if (data.results && data.results[0]) {
        const page = data.results[0];
        console.log('Found page:', page.title);
        console.log('Page ID:', page.id);
        console.log('Space:', page.space.name);
        console.log('\n--- FULL CONTENT ---');
        console.log(page.body.storage.value);
        return page;
    } else {
        console.log('Page not found');
        console.log('Response:', JSON.stringify(data, null, 2));
        return null;
    }
}

async function searchByUrl(urlPath) {
    // Extract space key and title from URL
    // URL: /confluence/display/EBR/OD+CHERY+T28+EU+BL05+RC3.4
    const parts = urlPath.split('/');
    const spaceKey = parts[3]; // EBR
    const titlePart = parts[4]; // OD+CHERY+T28+EU+BL05+RC3.4
    const title = decodeURIComponent(titlePart.replace(/\+/g, ' '));

    console.log('Extracted space:', spaceKey);
    console.log('Extracted title:', title);

    return await getPageBySpaceAndTitle(spaceKey, title);
}

async function createNewPage(spaceKey, title, content, parentId = null) {
    const pageData = {
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

    const response = await fetch(
        `${BASE_URL}/rest/api/content`,
        {
            method: 'POST',
            headers: {
                ...headers,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(pageData)
        }
    );

    const result = await response.json();

    if (response.ok) {
        console.log('Page created successfully!');
        console.log('New page ID:', result.id);
        console.log('New page URL:', `${BASE_URL}/display/${spaceKey}/${encodeURIComponent(title.replace(/ /g, '+'))}`);
        return result;
    } else {
        console.error('Failed to create page:', result);
        return null;
    }
}

async function copyPage(sourceUrl, targetSpaceKey, newTitle, parentId = null) {
    console.log('Step 1: Getting source page content...');
    const sourcePage = await searchByUrl(sourceUrl);

    if (!sourcePage) {
        console.error('Source page not found');
        return null;
    }

    console.log('Step 2: Creating new page...');
    const newPage = await createNewPage(
        targetSpaceKey,
        newTitle,
        sourcePage.body.storage.value,
        parentId
    );

    return newPage;
}

// Usage examples:

// 1. Get content from existing page
// searchByUrl('/confluence/display/EBR/OD+CHERY+T28+EU+BL05+RC6.1')
//     .then(page => {
//         if (page) {
//             console.log('\n=== PAGE TEMPLATE EXTRACTED ===');
//             console.log('Content length:', page.body.storage.value.length);
//         } else {
//             console.log('No page found');
//         }
//     })
//     .catch(error => {
//         console.error('Error:', error.message);
//     });

// 2. Copy page with parent - flexible version
async function copyPageWithParent(sourceUrl, parentUrl, targetSpaceKey, newTitle) {
    console.log('Getting parent page ID...');
    const parentPage = await searchByUrl(parentUrl);

    if (!parentPage) {
        console.error('Parent page not found');
        return;
    }

    console.log('Parent page found:', parentPage.title);
    console.log('Parent page ID:', parentPage.id);

    // Now copy the child page under this parent
    const result = await copyPage(
        sourceUrl,
        targetSpaceKey,
        newTitle,
        parentPage.id
    );

    if (result) {
        console.log('Page copied successfully under parent!');
    } else {
        console.log('Failed to copy page');
    }
}

// Usage examples (uncomment the one you want to use):

// Example 1: Copy RC6.1 to RC6.2 under the same parent
copyPageWithParent(
    '/confluence/display/EBR/OD+CHERY+T28+EU+BL05+RC6.1',  // source page
    '/confluence/display/EBR/OD+CHERY+T28+EU+BL05',        // parent page
    'EBR',                                                   // target space
    'OD CHERY T28 EU BL05 RC6.2'                           // new title
)
.catch(error => {
    console.error('Copy error:', error.message);
});

// Example 2: Copy with different naming pattern (commented out)
// copyPageWithParent(
//     '/confluence/display/EBR/OD+CHERY+T28+EU+BL05+RC3.4',  // source page
//     '/confluence/display/EBR/OD+CHERY+T28+EU+BL05',        // parent page
//     'EBR',                                                   // target space
//     'OD CHERY T28 EU BL05 RC4.0'                           // new title
// )
// .catch(error => {
//     console.error('Copy error:', error.message);
// });