#!/usr/bin/env python3
"""
Precise Confluence Page Updater
Updates the specific <time datetime=""> tag and Jira ticket references in Confluence pages
"""

import requests
import json
import re
import sys
import time
from datetime import datetime

# Configuration
PROXY_SERVER = "http://rb-proxy-apac.bosch.com:8080"
CONFLUENCE_BASE_URL = "https://inside-docupedia.bosch.com/confluence"
CONFLUENCE_PAT = "MzEyNTMxNTkwMjQ4OkuYP1fwScED9vGXzXCSLkdIqx+/"

def retry_request(func, *args, max_retries=3, delay=2, **kwargs):
    """
    Retry wrapper for network requests that may fail due to proxy issues
    """
    for attempt in range(max_retries):
        try:
            return func(*args, **kwargs)
        except (requests.exceptions.ProxyError, requests.exceptions.ConnectionError) as e:
            if attempt == max_retries - 1:  # Last attempt
                raise e
            print(f"🔄 Network error on attempt {attempt + 1}/{max_retries}: {str(e)}")
            print(f"⏰ Retrying in {delay} seconds...")
            time.sleep(delay)
            delay *= 1.5  # Exponential backoff

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
        response = retry_request(session.get, search_url, params=params, timeout=30)

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
    response = retry_request(session.get, url, params=params, timeout=30)

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
    response = retry_request(session.put, url, json=update_data, timeout=30)

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

def extract_page_title_from_url(url):
    """Extract page title from Confluence URL for display"""
    try:
        from urllib.parse import unquote

        url_parts = url.split('/')
        if 'display' not in url_parts:
            return url  # Return original if not a display URL

        display_idx = url_parts.index('display')
        if display_idx + 2 < len(url_parts):
            page_title_encoded = url_parts[display_idx + 2]
            page_title = unquote(page_title_encoded).replace('+', ' ')
            return page_title
        return url
    except:
        return url

def update_predecessor_baseline_precise(content, new_baseline_url):
    """Update the predecessor baseline URL and text"""
    print(f"🔗 Looking for predecessor baseline references...")

    # Extract display text from the new URL
    new_display_text = extract_page_title_from_url(new_baseline_url)

    print(f"📝 New baseline URL: {new_baseline_url}")
    print(f"📝 New display text: {new_display_text}")

    # Pattern to match: <td>...<strong>Predecessor Baseline</strong>...</td><td><a href="OLD_URL">OLD_TEXT</a></td>
    # More flexible pattern to capture the predecessor baseline link with various td attributes and styles
    pattern = r'(<td[^>]*><p[^>]*><strong>Predecessor Baseline</strong></p></td><td[^>]*><a href=")([^"]+)(">)([^<]+)(</a>)'

    match = re.search(pattern, content)

    if match:
        old_url = match.group(2)
        old_text = match.group(4)

        print(f"✅ Found predecessor baseline:")
        print(f"   - Current URL: {old_url}")
        print(f"   - Current text: {old_text}")
        print(f"🔄 Updating to:")
        print(f"   - New URL: {new_baseline_url}")
        print(f"   - New text: {new_display_text}")

        # Show context around the match
        start_pos = max(0, match.start() - 100)
        end_pos = min(len(content), match.end() + 100)
        context = content[start_pos:end_pos]
        print(f"📍 Context: ...{context.replace(chr(10), ' ').replace(chr(9), ' ')}...")

        # Perform the replacement - update both URL and display text
        updated_content = re.sub(
            pattern,
            f'\\g<1>{new_baseline_url}\\g<3>{new_display_text}\\g<5>',
            content
        )

        # Verify the change was made
        verify_match = re.search(pattern, updated_content)
        if verify_match and verify_match.group(2) == new_baseline_url and verify_match.group(4) == new_display_text:
            print(f"✅ Verification: Predecessor baseline successfully updated")
            return updated_content, old_url
        else:
            print("❌ Verification failed: Predecessor baseline was not updated correctly")
            return content, old_url

    else:
        print("❌ Could not find predecessor baseline pattern")
        print("🔍 Searching for alternative patterns...")

        # Look for simpler patterns
        alternative_patterns = [
            r'<strong>Predecessor Baseline</strong>',
            r'Predecessor Baseline',
            r'<a href="[^"]*display[^"]*">[^<]+</a>',
        ]

        for i, alt_pattern in enumerate(alternative_patterns):
            matches = re.findall(alt_pattern, content, re.IGNORECASE)
            if matches:
                print(f"Found alternative pattern {i+1}: {matches[:3]}")  # Show first 3 matches

        return content, None

def update_repository_baseline_precise(content, new_baseline_url):
    """Update the repository baseline URL in the SW Baseline section"""
    print(f"🔗 Looking for repository baseline references...")

    print(f"📝 New repository baseline URL: {new_baseline_url}")

    # Pattern to match: <span ...>Repository: <a href="OLD_URL">OLD_URL</a></span>
    # This appears in the SW Baseline section
    pattern = r'(<span[^>]*>Repository:[^<]*<a[^>]*href=")([^"]+)("[^>]*>)([^<]+)(</a>[^<]*</span>)'

    match = re.search(pattern, content)

    if match:
        old_url = match.group(2)
        old_text = match.group(4)

        print(f"✅ Found repository baseline:")
        print(f"   - Current URL: {old_url}")
        print(f"   - Current text: {old_text}")
        print(f"🔄 Updating to:")
        print(f"   - New URL: {new_baseline_url}")
        print(f"   - New text: {new_baseline_url}")

        # Show context around the match
        start_pos = max(0, match.start() - 100)
        end_pos = min(len(content), match.end() + 100)
        context = content[start_pos:end_pos]
        print(f"📍 Context: ...{context.replace(chr(10), ' ').replace(chr(9), ' ')}...")

        # Perform the replacement - update both URL and display text
        updated_content = re.sub(
            pattern,
            f'\\g<1>{new_baseline_url}\\g<3>{new_baseline_url}\\g<5>',
            content
        )

        # Verify the change was made
        verify_match = re.search(pattern, updated_content)
        if verify_match and verify_match.group(2) == new_baseline_url and verify_match.group(4) == new_baseline_url:
            print(f"✅ Verification: Repository baseline successfully updated")
            return updated_content, old_url
        else:
            print("❌ Verification failed: Repository baseline was not updated correctly")
            return content, old_url

    else:
        print("❌ Could not find repository baseline pattern")
        print("🔍 Searching for alternative patterns...")

        # Look for simpler patterns
        alternative_patterns = [
            r'Repository:',
            r'SW Baseline',
            r'<a href="[^"]*sourcecode[^"]*">[^<]+</a>',
        ]

        for i, alt_pattern in enumerate(alternative_patterns):
            matches = re.findall(alt_pattern, content, re.IGNORECASE)
            if matches:
                print(f"Found alternative pattern {i+1}: {matches[:3]}")  # Show first 3 matches

        return content, None

def main():
    if len(sys.argv) < 3:
        print("Usage:")
        print("  python3 update_gwm_precise.py <confluence_url> [date] [--jira key] [--baseline url]")
        print()
        print("Examples:")
        print("  Date only:")
        print("    python3 update_gwm_precise.py 'https://...display/EBR/Page' '2025-09-25'")
        print("  Jira only:")
        print("    python3 update_gwm_precise.py 'https://...display/EBR/Page' --jira MPCTEGWMA-3000")
        print("  Predecessor Baseline only:")
        print("    python3 update_gwm_precise.py 'https://...display/EBR/Page' --baseline 'https://...display/EBR/NewPage'")
        print("  Repository Baseline only:")
        print("    python3 update_gwm_precise.py 'https://...display/EBR/Page' --repo-baseline 'https://sourcecode06.dev.bosch.com/projects/G3N/repos/fvg3_lfs/commits?until=refs%2Fheads%2Frelease%2FCNGWM_FVE0120_BL02_V9'")
        print("  Multiple updates:")
        print("    python3 update_gwm_precise.py 'https://...display/EBR/Page' '2025-09-25' --jira MPCTEGWMA-3000")
        print("    python3 update_gwm_precise.py 'https://...display/EBR/Page' '2025-09-25' --baseline 'https://...display/EBR/NewPage'")
        print("    python3 update_gwm_precise.py 'https://...display/EBR/Page' '2025-09-25' --repo-baseline 'https://sourcecode06.dev.bosch.com/projects/G3N/repos/fvg3_lfs/commits?until=refs%2Fheads%2Frelease%2FCNGWM_FVE0120_BL02_V9'")
        print("    python3 update_gwm_precise.py 'https://...display/EBR/Page' '2025-09-25' --jira MPCTEGWMA-3000 --baseline 'https://...display/EBR/NewPage' --repo-baseline 'https://sourcecode06.dev.bosch.com/projects/G3N/repos/fvg3_lfs/commits?until=refs%2Fheads%2Frelease%2FCNGWM_FVE0120_BL02_V9'")
        print()
        print("  Legacy: You can still use page ID instead of URL if preferred")
        sys.exit(1)

    page_input = sys.argv[1]  # Can be URL or page ID

    # Parse arguments flexibly
    args = sys.argv[2:]  # Everything after the page input
    update_date = False
    update_jira = False
    update_baseline = False
    update_repo_baseline = False
    new_date = None
    new_jira_key = None
    new_baseline_url = None
    new_repo_baseline_url = None

    i = 0
    while i < len(args):
        arg = args[i]

        if arg == '--jira':
            if i + 1 >= len(args):
                print("❌ Missing Jira key after --jira flag")
                sys.exit(1)
            new_jira_key = args[i + 1]
            update_jira = True
            i += 2
        elif arg == '--baseline':
            if i + 1 >= len(args):
                print("❌ Missing baseline URL after --baseline flag")
                sys.exit(1)
            new_baseline_url = args[i + 1]
            update_baseline = True
            i += 2
        elif arg == '--repo-baseline':
            if i + 1 >= len(args):
                print("❌ Missing repository baseline URL after --repo-baseline flag")
                sys.exit(1)
            new_repo_baseline_url = args[i + 1]
            update_repo_baseline = True
            i += 2
        elif not arg.startswith('--'):
            # Assume it's a date
            if new_date is not None:
                print(f"❌ Multiple non-flag arguments found: '{new_date}' and '{arg}'. Only one date is allowed.")
                sys.exit(1)
            new_date = arg
            update_date = True
            i += 1
        else:
            print(f"❌ Unknown flag: {arg}")
            sys.exit(1)

    # Ensure at least one update type is specified
    if not (update_date or update_jira or update_baseline or update_repo_baseline):
        print("❌ No updates specified. Provide at least one of: date, --jira, --baseline, --repo-baseline")
        sys.exit(1)

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

    # Validate baseline URL format if updating baseline
    if update_baseline:
        if not (new_baseline_url.startswith('http') and 'display' in new_baseline_url):
            print(f"❌ Invalid baseline URL format: {new_baseline_url}")
            print("Please use a valid Confluence display URL (e.g., https://inside-docupedia.bosch.com/confluence/display/EBR/Page+Title)")
            sys.exit(1)

    # Validate repository baseline URL format if updating repo baseline
    if update_repo_baseline:
        if not (new_repo_baseline_url.startswith('http') and 'sourcecode' in new_repo_baseline_url):
            print(f"❌ Invalid repository baseline URL format: {new_repo_baseline_url}")
            print("Please use a valid repository URL (e.g., https://sourcecode06.dev.bosch.com/projects/G3N/repos/fvg3_lfs/commits?until=refs%2Fheads%2Frelease%2FCNGWM_FVE0120_BL02_V9)")
            sys.exit(1)

    print(f"🚀 Starting precise update")
    print(f"📄 Page input: {page_input}")
    if update_date:
        print(f"📅 New date: {new_date}")
    if update_jira:
        print(f"🎫 New Jira key: {new_jira_key}")
    if update_baseline:
        print(f"🔗 New predecessor baseline URL: {new_baseline_url}")
    if update_repo_baseline:
        print(f"📂 New repository baseline URL: {new_repo_baseline_url}")
    print()

    try:
        session = setup_session()
        print(f'page input: {page_input}')
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
        old_baseline_url = None
        old_repo_baseline_url = None
        new_display_text = None

        # Update the release date if requested
        if update_date:
            print("🔄 Updating release date...")
            date_updated_content = update_release_date_precise(updated_content, new_date)
            if date_updated_content != updated_content:
                updated_content = date_updated_content
                changes_made = True
                print("✅ Date update successful")
            else:
                # Check if the date was already correct
                current_date_match = re.search(r'<time datetime="([^"]*)"', updated_content)
                if current_date_match and current_date_match.group(1) == new_date:
                    print(f"ℹ️  Date is already set to {new_date} - no change needed")
                    changes_made = True  # This counts as a successful "update"
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

        # Update the predecessor baseline if requested
        if update_baseline:
            print("🔄 Updating predecessor baseline...")
            updated_content, old_baseline_url = update_predecessor_baseline_precise(updated_content, new_baseline_url)
            if old_baseline_url:
                changes_made = True
                print("✅ Predecessor baseline update successful")
                # Extract display text for the success message
                new_display_text = extract_page_title_from_url(new_baseline_url)
            else:
                print("⚠️  Predecessor baseline update failed")

        # Update the repository baseline if requested
        if update_repo_baseline:
            print("🔄 Updating repository baseline...")
            updated_content, old_repo_baseline_url = update_repository_baseline_precise(updated_content, new_repo_baseline_url)
            if old_repo_baseline_url:
                changes_made = True
                print("✅ Repository baseline update successful")
            else:
                print("⚠️  Repository baseline update failed")

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
        if update_baseline:
            print(f"🔗 Predecessor baseline changed from: {old_baseline_url} → {new_baseline_url}")
            print(f"📝 Display text: {new_display_text}")
        if update_repo_baseline:
            print(f"📂 Repository baseline changed from: {old_repo_baseline_url} → {new_repo_baseline_url}")

    except Exception as e:
        print(f"💥 Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()