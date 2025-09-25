#!/usr/bin/env python3
"""
Precise Confluence Page Updater
Updates the specific <time datetime=""> tag and Jira ticket references in Confluence pages
"""

import requests
import json
import re
import sys
from datetime import datetime

# Configuration
PROXY_SERVER = "http://rb-proxy-apac.bosch.com:8080"
CONFLUENCE_BASE_URL = "https://inside-docupedia.bosch.com/confluence"
CONFLUENCE_PAT = "MzEyNTMxNTkwMjQ4OkuYP1fwScED9vGXzXCSLkdIqx+/"

def setup_session():
    """Set up requests session with proxy and auth"""
    session = requests.Session()

    # Set up proxies
    session.proxies.update({
        'http': PROXY_SERVER,
        'https': PROXY_SERVER
    })

    # Set up authentication - try Bearer first
    session.headers.update({
        'Authorization': f'Bearer {CONFLUENCE_PAT}',
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Python Confluence Updater/1.0'
    })

    # Disable SSL verification
    session.verify = False

    # Disable SSL warnings
    import urllib3
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

    return session

def get_page_id_from_url(session, display_url):
    """Extract page ID from Confluence display URL"""
    try:
        # Clean and decode URL
        from urllib.parse import unquote

        print(f"🔗 Processing URL: {display_url}")

        # Parse URL to get space and page title
        url_parts = display_url.split('/')
        if 'display' not in url_parts:
            raise ValueError("Invalid display URL format. Expected: .../display/SPACE/PAGE_TITLE")

        display_idx = url_parts.index('display')
        space_key = url_parts[display_idx + 1]
        page_title_encoded = url_parts[display_idx + 2]

        # Decode URL encoding and handle + characters
        page_title = unquote(page_title_encoded).replace('+', ' ')

        print(f"🔍 Extracted - Space: '{space_key}', Title: '{page_title}'")

        # Search for the page using CQL
        cql_query = f'space="{space_key}" AND title="{page_title}"'
        search_url = f"{CONFLUENCE_BASE_URL}/rest/api/content/search"

        params = {
            'cql': cql_query,
            'expand': 'version'
        }

        print(f"🌐 Making search request...")
        response = session.get(search_url, params=params, timeout=30)

        if response.status_code == 401:
            print("🔑 Trying Basic auth...")
            session.headers.update({
                'Authorization': f'Basic {CONFLUENCE_PAT}'
            })
            response = session.get(search_url, params=params, timeout=30)

        if response.status_code != 200:
            print(f"❌ Search failed with status {response.status_code}")
            print(f"Response: {response.text[:500]}...")
            raise Exception(f"Search request failed: {response.status_code}")

        data = response.json()

        if not data.get('results') or len(data['results']) == 0:
            raise Exception(f"Page not found: '{page_title}' in space '{space_key}'")

        page_id = data['results'][0]['id']
        print(f"✅ Found page ID: {page_id}")
        return page_id

    except Exception as e:
        print(f"❌ Error getting page ID from URL: {e}")
        raise

def get_page(session, page_id):
    """Get page content"""
    url = f"{CONFLUENCE_BASE_URL}/rest/api/content/{page_id}"
    params = {
        'expand': 'body.storage,version'
    }

    print(f"📄 Fetching page {page_id}...")
    response = session.get(url, params=params, timeout=30)

    if response.status_code == 401:
        print("🔑 Trying Basic auth...")
        session.headers.update({
            'Authorization': f'Basic {CONFLUENCE_PAT}'
        })
        response = session.get(url, params=params, timeout=30)

    if response.status_code != 200:
        print(f"❌ Failed to get page: {response.status_code}")
        print(f"Response: {response.text[:300]}")
        raise Exception(f"Failed to get page: {response.status_code}")

    return response.json()

def update_page(session, page_id, title, content, version):
    """Update page content"""
    url = f"{CONFLUENCE_BASE_URL}/rest/api/content/{page_id}"

    update_data = {
        "version": {
            "number": version + 1
        },
        "title": title,
        "type": "page",
        "body": {
            "storage": {
                "value": content,
                "representation": "storage"
            }
        }
    }

    print(f"💾 Updating page to version {version + 1}...")
    response = session.put(url, json=update_data, timeout=30)

    if response.status_code == 401:
        print("🔑 Trying Basic auth for update...")
        session.headers.update({
            'Authorization': f'Basic {CONFLUENCE_PAT}'
        })
        response = session.put(url, json=update_data, timeout=30)

    if response.status_code != 200:
        print(f"❌ Update failed: {response.status_code}")
        print(f"Response: {response.text[:500]}")
        raise Exception(f"Failed to update page: {response.status_code}")

    return response.json()

def update_release_date_precise(content, new_date):
    """Update the specific <time datetime=""> tag"""
    print(f"🎯 Looking for <time datetime=\"\"> tag...")

    # Very specific pattern for the time tag we found
    pattern = r'(<time datetime=")([0-9]{4}-[0-9]{1,2}-[0-9]{1,2})(" />)'

    match = re.search(pattern, content)

    if match:
        old_date = match.group(2)
        print(f"✅ Found current date: {old_date}")
        print(f"🔄 Updating to: {new_date}")

        # Show context around the match
        start_pos = max(0, match.start() - 100)
        end_pos = min(len(content), match.end() + 100)
        context = content[start_pos:end_pos]
        print(f"📍 Context: ...{context}...")

        # Perform the replacement
        updated_content = re.sub(pattern, f'\\g<1>{new_date}\\g<3>', content)

        # Verify the change was made
        verify_match = re.search(pattern, updated_content)
        if verify_match and verify_match.group(2) == new_date:
            print(f"✅ Verification: Date successfully updated to {new_date}")
            return updated_content
        else:
            print("❌ Verification failed: Date was not updated correctly")
            return content

    else:
        print("❌ Could not find <time datetime=\"\"> pattern")
        print("🔍 Searching for any time tags...")

        # Look for any time tags
        time_tags = re.findall(r'<time[^>]*>', content)
        if time_tags:
            print(f"Found time tags: {time_tags}")
        else:
            print("No time tags found at all")

        return content

def update_jira_ticket_precise(content, new_jira_key):
    """Update Jira ticket key in ac:parameter tags"""
    print(f"🎫 Looking for Jira ticket references...")

    # Pattern for Confluence structured macro parameter: <ac:parameter ac:name="key">MPCTEGWMA-2216</ac:parameter>
    pattern = r'(<ac:parameter ac:name="key">)([A-Z]+-[0-9]+)(</ac:parameter>)'

    matches = list(re.finditer(pattern, content))

    if matches:
        print(f"✅ Found {len(matches)} Jira key reference(s):")

        old_jira_keys = []
        updated_content = content

        for i, match in enumerate(matches):
            old_jira_key = match.group(2)
            old_jira_keys.append(old_jira_key)
            print(f"   {i+1}. {old_jira_key}")

            # Show context around the match
            start_pos = max(0, match.start() - 100)
            end_pos = min(len(content), match.end() + 100)
            context = content[start_pos:end_pos]
            print(f"📍 Context {i+1}: ...{context.replace(chr(10), ' ').replace(chr(9), ' ')}...")

        print(f"🔄 Updating all to: {new_jira_key}")

        # Perform the replacement for all matches
        updated_content = re.sub(pattern, f'\\g<1>{new_jira_key}\\g<3>', content)

        # Verify the changes were made
        verify_matches = re.findall(pattern, updated_content)
        new_keys = [match[1] for match in verify_matches]

        if all(key == new_jira_key for key in new_keys):
            print(f"✅ Verification: All {len(matches)} Jira keys successfully updated to {new_jira_key}")
            return updated_content, old_jira_keys[0] if old_jira_keys else None
        else:
            print("❌ Verification failed: Some Jira keys were not updated correctly")
            print(f"Expected: {new_jira_key}, Found: {new_keys}")
            return content, old_jira_keys[0] if old_jira_keys else None

    else:
        print("❌ Could not find Confluence structured macro pattern")
        print("🔍 Searching for any Jira key patterns...")

        # Look for other possible patterns
        other_patterns = [
            r'data-jira-key="([^"]*)"',
            r'>([A-Z]+-[0-9]+)</a>',
            r'browse/([A-Z]+-[0-9]+)',
            r'[A-Z]+-[0-9]+',  # Generic pattern
        ]

        for i, other_pattern in enumerate(other_patterns):
            matches = re.findall(other_pattern, content)
            if matches:
                print(f"Found pattern {i+1}: {matches[:5]}...")  # Show first 5 matches

        return content, None

def main():
    if len(sys.argv) < 3 or len(sys.argv) > 5:
        print("Usage:")
        print("  Update date only:")
        print("    python3 update_gwm_precise.py <confluence_url> <new_date>")
        print("    Example: python3 update_gwm_precise.py 'https://inside-docupedia.bosch.com/confluence/display/EBR/GWM+FVE0120+BL02+V6.4' '2025-09-25'")
        print()
        print("  Update Jira key only:")
        print("    python3 update_gwm_precise.py <confluence_url> --jira <new_jira_key>")
        print("    Example: python3 update_gwm_precise.py 'https://inside-docupedia.bosch.com/confluence/display/EBR/GWM+FVE0120+BL02+V6.4' --jira MPCTEGWMA-3000")
        print()
        print("  Update both date and Jira key:")
        print("    python3 update_gwm_precise.py <confluence_url> <new_date> --jira <new_jira_key>")
        print("    Example: python3 update_gwm_precise.py 'https://inside-docupedia.bosch.com/confluence/display/EBR/GWM+FVE0120+BL02+V6.4' '2025-09-25' --jira MPCTEGWMA-3000")
        print()
        print("  Legacy: You can still use page ID instead of URL if preferred")
        sys.exit(1)

    page_input = sys.argv[1]  # Can be URL or page ID

    # Parse arguments
    update_date = False
    update_jira = False
    new_date = None
    new_jira_key = None

    if len(sys.argv) == 3:
        # Either date or --jira flag
        if sys.argv[2] == '--jira':
            print("❌ Missing Jira key after --jira flag")
            sys.exit(1)
        else:
            # Date update
            new_date = sys.argv[2]
            update_date = True
    elif len(sys.argv) == 4:
        if sys.argv[2] == '--jira':
            # Jira key update only
            new_jira_key = sys.argv[3]
            update_jira = True
        else:
            print("❌ Invalid arguments. Use --jira flag for Jira key updates.")
            sys.exit(1)
    elif len(sys.argv) == 5:
        # Both date and jira
        new_date = sys.argv[2]
        if sys.argv[3] != '--jira':
            print("❌ Expected --jira flag as third argument")
            sys.exit(1)
        new_jira_key = sys.argv[4]
        update_date = True
        update_jira = True

    # Validate date format if updating date
    if update_date:
        try:
            datetime.strptime(new_date, '%Y-%m-%d')
        except ValueError:
            print(f"❌ Invalid date format: {new_date}")
            print("Please use YYYY-MM-DD format (e.g., 2025-09-25)")
            sys.exit(1)

    # Validate Jira key format if updating Jira
    if update_jira:
        if not re.match(r'^[A-Z]+-[0-9]+$', new_jira_key):
            print(f"❌ Invalid Jira key format: {new_jira_key}")
            print("Please use format PROJECT-NUMBER (e.g., MPCTEGWMA-2216)")
            sys.exit(1)

    print(f"🚀 Starting precise update")
    print(f"📄 Page input: {page_input}")
    if update_date:
        print(f"📅 New date: {new_date}")
    if update_jira:
        print(f"🎫 New Jira key: {new_jira_key}")
    print()

    try:
        session = setup_session()
        print('page input: {page_input}')
        # Determine if input is URL or page ID
        if (page_input.startswith('http') and 'display' in page_input) or (page_input.startswith('https') and 'display' in page_input):
            print("🔗 Input detected as Confluence URL")
            page_id = get_page_id_from_url(session, page_input)
        elif page_input.isdigit():
            print("🔢 Input detected as page ID")
            page_id = page_input
        else:
            print(f"❌ Invalid input format: '{page_input}'")
            print("Expected: Confluence URL with 'display' or numeric page ID")
            raise ValueError("Input must be either a Confluence URL (https://...) or a numeric page ID")

        # Get current page
        page_data = get_page(session, page_id)
        current_version = page_data['version']['number']
        current_content = page_data['body']['storage']['value']
        title = page_data['title']

        print(f"📖 Page: {title}")
        print(f"🆔 Page ID: {page_id}")
        print(f"🔢 Current version: {current_version}")
        print()

        updated_content = current_content
        changes_made = False
        old_jira_key = None

        # Update the release date if requested
        if update_date:
            print("🔄 Updating release date...")
            updated_content = update_release_date_precise(updated_content, new_date)
            if updated_content != current_content:
                changes_made = True
                print("✅ Date update successful")
            else:
                print("⚠️  Date update failed")

        # Update the Jira key if requested
        if update_jira:
            print("🔄 Updating Jira ticket...")
            updated_content, old_jira_key = update_jira_ticket_precise(updated_content, new_jira_key)
            if old_jira_key:
                changes_made = True
                print("✅ Jira key update successful")
            else:
                print("⚠️  Jira key update failed")

        if not changes_made:
            print("⚠️  No changes made - could not find or update the requested fields")
            sys.exit(1)

        # Update the page
        result = update_page(session, page_id, title, updated_content, current_version)

        print()
        print("🎉 Success!")
        print(f"✅ Page updated to version {result['version']['number']}")
        if update_date:
            print(f"📅 Release date changed to: {new_date}")
        if update_jira:
            print(f"🎫 Jira key changed from: {old_jira_key} → {new_jira_key}")

    except Exception as e:
        print(f"💥 Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()