#!/usr/bin/env python3
"""
Inspect Confluence page content to understand structure before updating
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

    # Set up authentication
    session.headers.update({
        'Authorization': f'Bearer {CONFLUENCE_PAT}',
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Python Confluence Inspector/1.0'
    })

    # Disable SSL verification
    session.verify = False

    # Disable SSL warnings
    import urllib3
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

    return session

def get_page_content(session, page_id):
    """Get the full page content"""
    url = f"{CONFLUENCE_BASE_URL}/rest/api/content/{page_id}"
    params = {
        'expand': 'body.storage,version'
    }

    print(f"Fetching page content for ID: {page_id}")
    response = session.get(url, params=params, timeout=30)

    if response.status_code == 401:
        print("Trying Basic auth...")
        session.headers.update({
            'Authorization': f'Basic {CONFLUENCE_PAT}'
        })
        response = session.get(url, params=params, timeout=30)

    if response.status_code != 200:
        print(f"Failed to get page: {response.status_code}")
        print(f"Response: {response.text[:500]}")
        return None

    return response.json()

def analyze_content(content):
    """Analyze the content structure around release date"""
    print("🔍 Analyzing page content structure...")
    print("=" * 60)

    # Find all mentions of "release date"
    release_matches = list(re.finditer(r'release\s*date', content, re.IGNORECASE))

    print(f"Found {len(release_matches)} mentions of 'release date'")
    print()

    for i, match in enumerate(release_matches):
        print(f"📍 Match {i+1}:")
        start_pos = max(0, match.start() - 150)
        end_pos = min(len(content), match.end() + 150)
        context = content[start_pos:end_pos]

        # Clean up whitespace for display
        clean_context = re.sub(r'\s+', ' ', context)

        print(f"Context: {clean_context}")
        print("-" * 40)

        # Try to identify the structure around this match
        if '<th' in context and '</th>' in context:
            print("  → Appears to be in a table header")
        elif '<td' in context and '</td>' in context:
            print("  → Appears to be in a table cell")
        elif '<p' in context and '</p>' in context:
            print("  → Appears to be in a paragraph")
        elif '<li' in context and '</li>' in context:
            print("  → Appears to be in a list item")

        print()

    print("=" * 60)

    # Look for date-like patterns near release date
    print("🗓️  Looking for date patterns near 'release date':")
    date_patterns = [
        r'\d{4}-\d{1,2}-\d{1,2}',  # YYYY-MM-DD
        r'\d{1,2}/\d{1,2}/\d{4}',  # MM/DD/YYYY
        r'[A-Za-z]+ \d{1,2}, \d{4}',  # Month DD, YYYY
        r'\d{1,2}-[A-Za-z]{3}-\d{4}',  # DD-Mon-YYYY
    ]

    for pattern in date_patterns:
        dates = re.findall(pattern, content)
        if dates:
            print(f"  Found {len(dates)} dates matching '{pattern}': {dates[:5]}")  # Show first 5

    print()

def save_content_to_file(content, filename="page_content.html"):
    """Save the raw content to a file for inspection"""
    with open(filename, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"💾 Raw content saved to: {filename}")

def main():
    if len(sys.argv) != 2:
        print("Usage: python3 inspect_page.py <page_id>")
        print("Example: python3 inspect_page.py 6283400128")
        sys.exit(1)

    page_id = sys.argv[1]

    try:
        session = setup_session()
        page_data = get_page_content(session, page_id)

        if not page_data:
            print("Failed to get page data")
            sys.exit(1)

        print(f"📄 Page: {page_data['title']}")
        print(f"🔢 Version: {page_data['version']['number']}")
        print()

        content = page_data['body']['storage']['value']

        # Save raw content for inspection
        save_content_to_file(content)

        # Analyze the content
        analyze_content(content)

        print("✅ Analysis complete!")
        print("💡 Use this information to create precise regex patterns for updating the release date.")

    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()