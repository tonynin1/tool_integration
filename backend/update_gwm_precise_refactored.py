#!/usr/bin/env python3
"""
Precise Confluence Page Updater
Updates specific fields in Confluence pages: dates, Jira tickets, and baseline URLs
"""

import requests
import re
import sys
import time
from datetime import datetime
from dataclasses import dataclass
from typing import Optional, Tuple, Dict, Any
from urllib.parse import unquote

# ============================================================================
# CONFIGURATION
# ============================================================================
PROXY_SERVER = "http://rb-proxy-apac.bosch.com:8080"
CONFLUENCE_BASE_URL = "https://inside-docupedia.bosch.com/confluence"
CONFLUENCE_PAT = "MzEyNTMxNTkwMjQ4OkuYP1fwScED9vGXzXCSLkdIqx+/"

# Network settings
MAX_RETRIES = 3
INITIAL_DELAY = 2
TIMEOUT = 30

# Regex patterns
PATTERNS = {
    'release_date': r'(<time datetime=")([0-9]{4}-[0-9]{1,2}-[0-9]{1,2})(" />)',
    'jira_ticket': r'(<ac:parameter ac:name="key">)([A-Z]+-[0-9]+)(</ac:parameter>)',
    'predecessor_baseline': r'(<td[^>]*><p[^>]*><strong>Predecessor Baseline</strong></p></td><td[^>]*><a href=")([^"]+)(">)([^<]+)(</a>)',
    'repository_baseline': r'(<span[^>]*>Repository:[^<]*<a[^>]*href=")([^"]+)("[^>]*>)([^<]+)(</a>[^<]*</span>)',
    'commit_link': r'(<span[^>]*>Commit:\s*<a href=")([^"]+)(">)([^<\s]+)(\s*</a>\s*<br />\s*</span>)',
    'tag_link': r'(<span[^>]*>Tag:\s*<a href=")([^"]+)(">)([^<]+)(</a>\s*</span>)',
    'branch_link': r'(<span[^>]*>Branch:\s*<a href=")([^"]+)(">)([^<]+)(</a>\s*</span>)',
    'binary_path': r'(<span>)(\\\\<a class="external-link" href="[^"]*">[^<]+</a>\\[^<]+)(</span>)',
    'mea_tool_links': r'(<th class="highlight-#deebff"[^>]*data-highlight-colour="#deebff">MEA</th><td[^>]*>)(.*?)(</td>)',
    'adm_tool_link': r'(<th class="highlight-blue"[^>]*data-highlight-colour="blue">ADM</th><td[^>]*>)(.*?)(</td>)',
    'restbus_tool_link': r'(<th class="highlight-#deebff"[^>]*data-highlight-colour="#deebff">Restbus</th><td[^>]*>)(.*?)(</td>)',
    'int_test_links': r'(\\\\abtvdfs2\.de\.bosch\.com[^<]*\\Int_test)'
}

@dataclass
class UpdateConfig:
    """Configuration for what updates to perform"""
    date: Optional[str] = None
    jira_key: Optional[str] = None
    predecessor_baseline_url: Optional[str] = None
    repository_baseline_url: Optional[str] = None
    commit_id: Optional[str] = None
    commit_url: Optional[str] = None
    tag_name: Optional[str] = None
    tag_url: Optional[str] = None
    branch_name: Optional[str] = None
    branch_url: Optional[str] = None
    binary_path: Optional[str] = None
    tool_links: Optional[str] = None
    int_test_links: Optional[str] = None

@dataclass
class UpdateResult:
    """Result of an update operation"""
    success: bool
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    error: Optional[str] = None

# ============================================================================
# NETWORK AND SESSION MANAGEMENT
# ============================================================================
class ConfluenceClient:
    """Handles all Confluence API interactions"""

    def __init__(self):
        self.session = self._setup_session()

    def _setup_session(self) -> requests.Session:
        """Set up requests session with proxy and auth"""
        session = requests.Session()

        # Configure proxy
        session.proxies.update({
            'http': PROXY_SERVER,
            'https': PROXY_SERVER
        })

        # Configure authentication
        session.headers.update({
            'Authorization': f'Bearer {CONFLUENCE_PAT}',
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'Python Confluence Updater/2.0'
        })

        # Disable SSL verification and warnings
        session.verify = False
        import urllib3
        urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

        return session

    def _retry_request(self, func, *args, **kwargs) -> requests.Response:
        """Retry wrapper for network requests"""
        delay = INITIAL_DELAY

        for attempt in range(MAX_RETRIES):
            try:
                return func(*args, **kwargs)
            except (requests.exceptions.ProxyError, requests.exceptions.ConnectionError) as e:
                if attempt == MAX_RETRIES - 1:
                    raise e
                print(f"🔄 Network error on attempt {attempt + 1}/{MAX_RETRIES}: {str(e)}")
                print(f"⏰ Retrying in {delay} seconds...")
                time.sleep(delay)
                delay *= 1.5  # Exponential backoff

        raise Exception("All retry attempts failed")

    def get_page_id_from_url(self, display_url: str) -> str:
        """Extract page ID from Confluence display URL"""
        print(f"🔗 Looking up page from URL...")

        # Parse URL components
        url_parts = display_url.split('/')
        if 'display' not in url_parts:
            raise ValueError("Invalid display URL format. Expected: .../display/SPACE/PAGE_TITLE")

        display_idx = url_parts.index('display')
        space_key = url_parts[display_idx + 1]
        page_title_encoded = url_parts[display_idx + 2]
        page_title = unquote(page_title_encoded).replace('+', ' ')

        # Search for page using CQL
        cql_query = f'space="{space_key}" AND title="{page_title}"'
        search_url = f"{CONFLUENCE_BASE_URL}/rest/api/content/search"

        params = {'cql': cql_query, 'expand': 'version'}
        response = self._retry_request(
            self.session.get, search_url, params=params, timeout=TIMEOUT
        )

        if response.status_code == 401:
            self.session.headers.update({'Authorization': f'Basic {CONFLUENCE_PAT}'})
            response = self.session.get(search_url, params=params, timeout=TIMEOUT)

        if response.status_code != 200:
            raise Exception(f"Search request failed: {response.status_code}")

        data = response.json()
        if not data.get('results'):
            raise Exception(f"Page not found: '{page_title}' in space '{space_key}'")

        page_id = data['results'][0]['id']
        print(f"✅ Found page ID: {page_id}")
        return page_id

    def get_page(self, page_id: str) -> Dict[str, Any]:
        """Get page content"""
        url = f"{CONFLUENCE_BASE_URL}/rest/api/content/{page_id}"
        params = {'expand': 'body.storage,version'}

        print(f"📄 Getting page content...")
        response = self._retry_request(
            self.session.get, url, params=params, timeout=TIMEOUT
        )

        if response.status_code == 401:
            self.session.headers.update({'Authorization': f'Basic {CONFLUENCE_PAT}'})
            response = self.session.get(url, params=params, timeout=TIMEOUT)

        if response.status_code != 200:
            raise Exception(f"Failed to get page: {response.status_code}")

        return response.json()

    def update_page(self, page_id: str, title: str, content: str, version: int) -> Dict[str, Any]:
        """Update page content"""
        url = f"{CONFLUENCE_BASE_URL}/rest/api/content/{page_id}"

        update_data = {
            "version": {"number": version + 1},
            "title": title,
            "type": "page",
            "body": {
                "storage": {
                    "value": content,
                    "representation": "storage"
                }
            }
        }

        print(f"💾 Saving changes...")
        response = self._retry_request(
            self.session.put, url, json=update_data, timeout=TIMEOUT
        )

        if response.status_code == 401:
            self.session.headers.update({'Authorization': f'Basic {CONFLUENCE_PAT}'})
            response = self.session.put(url, json=update_data, timeout=TIMEOUT)

        if response.status_code != 200:
            raise Exception(f"Failed to update page: {response.status_code}")

        return response.json()

# ============================================================================
# CONTENT UPDATE FUNCTIONS
# ============================================================================
class ContentUpdater:
    """Handles updating different types of content in Confluence pages"""

    @staticmethod
    def update_release_date(content: str, new_date: str) -> UpdateResult:
        """Update the release date"""
        print("🔄 Updating release date...")

        pattern = PATTERNS['release_date']
        match = re.search(pattern, content)

        if not match:
            return UpdateResult(False, error="Release date pattern not found")

        old_date = match.group(2)
        if old_date == new_date:
            print(f"ℹ️  Date is already set to {new_date}")
            return UpdateResult(True, old_date, new_date)

        print(f"✅ Found current date: {old_date}")
        print(f"🔄 Updating to: {new_date}")

        # Perform replacement
        updated_content = re.sub(pattern, f'\\g<1>{new_date}\\g<3>', content)

        # Verify
        verify_match = re.search(pattern, updated_content)
        if verify_match and verify_match.group(2) == new_date:
            return UpdateResult(True, old_date, new_date)

        return UpdateResult(False, old_date, error="Verification failed")

    @staticmethod
    def update_jira_ticket(content: str, new_jira_key: str) -> UpdateResult:
        """Update Jira ticket references"""
        print("🔄 Updating Jira ticket...")

        pattern = PATTERNS['jira_ticket']
        matches = list(re.finditer(pattern, content))

        if not matches:
            return UpdateResult(False, error="Jira ticket pattern not found")

        old_jira_keys = [match.group(2) for match in matches]
        old_jira_key = old_jira_keys[0]

        print(f"✅ Found {len(matches)} Jira key reference(s):")
        for i, match in enumerate(matches):
            key = match.group(2)
            print(f"   {i+1}. {key}")

        print(f"🔄 Updating all to: {new_jira_key}")

        # Perform replacement
        updated_content = re.sub(pattern, f'\\g<1>{new_jira_key}\\g<3>', content)

        # Verify
        verify_matches = re.findall(pattern, updated_content)
        new_keys = [match[1] for match in verify_matches]

        if all(key == new_jira_key for key in new_keys):
            return UpdateResult(True, old_jira_key, new_jira_key)

        return UpdateResult(False, old_jira_key, error="Verification failed")

    @staticmethod
    def update_predecessor_baseline(content: str, new_baseline_url: str) -> UpdateResult:
        """Update predecessor baseline URL"""
        print("🔄 Updating predecessor baseline...")

        pattern = PATTERNS['predecessor_baseline']
        match = re.search(pattern, content)

        if not match:
            return UpdateResult(False, error="Predecessor baseline pattern not found")

        old_url = match.group(2)
        old_text = match.group(4)
        new_display_text = ContentUpdater._extract_page_title_from_url(new_baseline_url)

        print(f"✅ Found predecessor baseline:")
        print(f"   - Current URL: {old_url}")
        print(f"   - Current text: {old_text}")
        print(f"🔄 Updating to:")
        print(f"   - New URL: {new_baseline_url}")
        print(f"   - New text: {new_display_text}")

        # Perform replacement
        updated_content = re.sub(
            pattern,
            f'\\g<1>{new_baseline_url}\\g<3>{new_display_text}\\g<5>',
            content
        )

        # Verify
        verify_match = re.search(pattern, updated_content)
        if (verify_match and
            verify_match.group(2) == new_baseline_url and
            verify_match.group(4) == new_display_text):
            return UpdateResult(True, old_url, new_baseline_url)

        return UpdateResult(False, old_url, error="Verification failed")

    @staticmethod
    def update_repository_baseline(content: str, new_baseline_url: str) -> UpdateResult:
        """Update repository baseline URL"""
        print("🔄 Updating repository baseline...")

        pattern = PATTERNS['repository_baseline']
        match = re.search(pattern, content)

        if not match:
            return UpdateResult(False, error="Repository baseline pattern not found")

        old_url = match.group(2)
        old_text = match.group(4)

        print(f"✅ Found repository baseline:")
        print(f"   - Current URL: {old_url}")
        print(f"   - Current text: {old_text}")
        print(f"🔄 Updating to:")
        print(f"   - New URL: {new_baseline_url}")
        print(f"   - New text: {new_baseline_url}")


        # Perform replacement
        updated_content = re.sub(
            pattern,
            f'\\g<1>{new_baseline_url}\\g<3>{new_baseline_url}\\g<5>',
            content
        )

        # Verify
        verify_match = re.search(pattern, updated_content)
        if (verify_match and
            verify_match.group(2) == new_baseline_url and
            verify_match.group(4) == new_baseline_url):
            return UpdateResult(True, old_url, new_baseline_url)

        return UpdateResult(False, old_url, error="Verification failed")

    @staticmethod
    def update_commit_info(content: str, commit_id: str, commit_url: str) -> UpdateResult:
        """Update commit ID and URL"""
        print("🔄 Updating commit information...")

        pattern = PATTERNS['commit_link']
        match = re.search(pattern, content)

        if not match:
            return UpdateResult(False, error="Commit link pattern not found")

        old_url = match.group(2)
        old_commit_id = match.group(4)

        print(f"✅ Found commit information:")
        print(f"   - Current URL: {old_url}")
        print(f"   - Current Commit ID: {old_commit_id}")
        print(f"🔄 Updating to:")
        print(f"   - New URL: {commit_url}")
        print(f"   - New Commit ID: {commit_id}")

        # Perform replacement
        updated_content = re.sub(
            pattern,
            f'\\g<1>{commit_url}\\g<3>{commit_id}\\g<5>',
            content
        )

        # Verify
        verify_match = re.search(pattern, updated_content)
        if (verify_match and
            verify_match.group(2) == commit_url and
            verify_match.group(4) == commit_id):
            return UpdateResult(True, old_commit_id, commit_id)

        return UpdateResult(False, old_commit_id, error="Verification failed")

    @staticmethod
    def update_tag_info(content: str, tag_name: str, tag_url: str) -> UpdateResult:
        """Update tag name and URL"""
        print("🔄 Updating tag information...")

        pattern = PATTERNS['tag_link']
        match = re.search(pattern, content)

        if not match:
            return UpdateResult(False, error="Tag link pattern not found")

        old_url = match.group(2)
        old_tag = match.group(4)

        print(f"✅ Found tag information:")
        print(f"   - Current URL: {old_url}")
        print(f"   - Current Tag: {old_tag}")
        print(f"🔄 Updating to:")
        print(f"   - New URL: {tag_url}")
        print(f"   - New Tag: {tag_name}")

        # Perform replacement
        updated_content = re.sub(
            pattern,
            f'\\g<1>{tag_url}\\g<3>{tag_name}\\g<5>',
            content
        )

        # Verify
        verify_match = re.search(pattern, updated_content)
        if (verify_match and
            verify_match.group(2) == tag_url and
            verify_match.group(4) == tag_name):
            return UpdateResult(True, old_tag, tag_name)

        return UpdateResult(False, old_tag, error="Verification failed")

    @staticmethod
    def update_branch_info(content: str, branch_name: str, branch_url: str) -> UpdateResult:
        """Update branch name and URL"""
        print("🔄 Updating branch information...")

        pattern = PATTERNS['branch_link']
        match = re.search(pattern, content)

        if not match:
            return UpdateResult(False, error="Branch link pattern not found")

        old_url = match.group(2)
        old_branch = match.group(4)

        print(f"✅ Found branch information:")
        print(f"   - Current URL: {old_url}")
        print(f"   - Current Branch: {old_branch}")
        print(f"🔄 Updating to:")
        print(f"   - New URL: {branch_url}")
        print(f"   - New Branch: {branch_name}")

        # Perform replacement
        updated_content = re.sub(
            pattern,
            f'\\g<1>{branch_url}\\g<3>{branch_name}\\g<5>',
            content
        )

        # Verify
        verify_match = re.search(pattern, updated_content)
        if (verify_match and
            verify_match.group(2) == branch_url and
            verify_match.group(4) == branch_name):
            return UpdateResult(True, old_branch, branch_name)

        return UpdateResult(False, old_branch, error="Verification failed")
    @staticmethod
    def update_binary_path(content: str, new_path: str) -> UpdateResult:
        """Update binary file path in the Binaries section"""
        print("🔄 Updating binary path...")

        pattern = PATTERNS['binary_path']
        match = re.search(pattern, content)

        if not match:
            return UpdateResult(False, error="Binary path pattern not found")

        old_full_path = match.group(2)

        print(f"✅ Found binary path:")
        print(f"   - Current path: {old_full_path}")
        print(f"🔄 Updating to:")
        print(f"   - New path: {new_path}")

        # If the new path is a simple path (without HTML), convert it to the expected HTML format
        if not '<a class="external-link"' in new_path:
            # Extract server and path components
            if new_path.startswith('\\\\'):
                # Format: \\server\path...
                parts = new_path[2:].split('\\', 1)  # Remove \\ and split at first \
                server = parts[0] if len(parts) > 0 else ''
                remaining_path = '\\' + parts[1] if len(parts) > 1 else ''

                # Create HTML format with link
                formatted_new_path = f'\\\\<a class="external-link" href="http://{server}/">{server}</a>{remaining_path}'
            else:
                formatted_new_path = new_path
        else:
            formatted_new_path = new_path

        # Perform replacement - escape the new_path to handle backslashes
        escaped_new_path = formatted_new_path.replace('\\', '\\\\')
        updated_content = re.sub(
            pattern,
            f'\\g<1>{escaped_new_path}\\g<3>',
            content
        )

        # Verify
        verify_match = re.search(pattern, updated_content)
        if verify_match:
            actual_new_path = verify_match.group(2)
            if actual_new_path == escaped_new_path:
                return UpdateResult(True, old_full_path, new_path)
            else:
                return UpdateResult(False, old_full_path, error=f"Verification failed - expected '{escaped_new_path}' but got '{actual_new_path}'")
        else:
            return UpdateResult(False, old_full_path, error="Verification failed - no match found after update")

    @staticmethod
    def update_tool_links(content: str, new_tool_link: str) -> UpdateResult:
        """Update Tool Release Info table links (MEA, ADM, Restbus)"""
        print("🔄 Updating Tool Release Info table...")

        # Escape backslashes for regex replacement
        escaped_link = new_tool_link.replace('\\', '\\\\')

        # Define the new content for each tool row
        mea_new_content = f'<p>{escaped_link}</p><p>{escaped_link}</p>'
        adm_new_content = escaped_link
        restbus_new_content = escaped_link

        updated_content = content
        changes_made = False

        # Update MEA links (2 links)
        mea_pattern = PATTERNS['mea_tool_links']
        mea_match = re.search(mea_pattern, updated_content, re.DOTALL)
        if mea_match:
            print(f"✅ Found MEA links, updating...")
            updated_content = re.sub(mea_pattern, lambda m: f'{m.group(1)}{mea_new_content}{m.group(3)}', updated_content, flags=re.DOTALL)
            changes_made = True
        else:
            print("⚠️  MEA pattern not found")

        # Update ADM link (1 link)
        adm_pattern = PATTERNS['adm_tool_link']
        adm_match = re.search(adm_pattern, updated_content, re.DOTALL)
        if adm_match:
            print(f"✅ Found ADM link, updating...")
            updated_content = re.sub(adm_pattern, lambda m: f'{m.group(1)}{adm_new_content}{m.group(3)}', updated_content, flags=re.DOTALL)
            changes_made = True
        else:
            print("⚠️  ADM pattern not found")

        # Update Restbus link (1 link)
        restbus_pattern = PATTERNS['restbus_tool_link']
        restbus_match = re.search(restbus_pattern, updated_content, re.DOTALL)
        if restbus_match:
            print(f"✅ Found Restbus link, updating...")
            updated_content = re.sub(restbus_pattern, lambda m: f'{m.group(1)}{restbus_new_content}{m.group(3)}', updated_content, flags=re.DOTALL)
            changes_made = True
        else:
            print("⚠️  Restbus pattern not found")

        if changes_made:
            return UpdateResult(True, "Tool Release Info links", new_tool_link)
        else:
            return UpdateResult(False, error="No tool link patterns found")

    @staticmethod
    def update_int_test_links(content: str, new_link: str) -> UpdateResult:
        """Update INT Test table links with \Int_test suffix"""
        print("🔄 Updating INT Test table...")

        # Escape backslashes and add Int_test suffix
        escaped_link = new_link.replace('\\', '\\\\')
        escaped_link_with_int_test = escaped_link + '\\\\Int_test'

        # Generate the new INT Test link content to match HTML structure
        int_test_replacement = f'\\\\abtvdfs2.de.bosch.com{escaped_link_with_int_test}'

        # Update all INT Test links at once
        int_test_pattern = PATTERNS['int_test_links']
        int_test_matches = re.findall(int_test_pattern, content)
        if int_test_matches:
            print(f"✅ Found {len(int_test_matches)} INT Test links, updating...")
            updated_content = re.sub(int_test_pattern, int_test_replacement, content)
            return UpdateResult(True, "INT Test links", new_link)
        else:
            print("⚠️  No INT Test links found")
            return UpdateResult(False, error="No INT Test link patterns found")

    @staticmethod
    def _extract_page_title_from_url(url: str) -> str:
        """Extract page title from Confluence URL for display"""
        try:
            url_parts = url.split('/')
            if 'display' not in url_parts:
                return url

            display_idx = url_parts.index('display')
            if display_idx + 2 < len(url_parts):
                page_title_encoded = url_parts[display_idx + 2]
                page_title = unquote(page_title_encoded).replace('+', ' ')
                return page_title
            return url
        except:
            return url

# ============================================================================
# ARGUMENT PARSING AND VALIDATION
# ============================================================================
class ArgumentParser:
    """Handles command line argument parsing and validation"""

    @staticmethod
    def parse_arguments(args: list) -> Tuple[str, UpdateConfig]:
        """Parse command line arguments"""
        if len(args) < 3:
            ArgumentParser._show_usage()
            sys.exit(1)

        page_input = args[1]
        config = UpdateConfig()

        # Parse remaining arguments
        i = 2
        while i < len(args):
            arg = args[i]

            if arg == '--jira':
                if i + 1 >= len(args):
                    raise ValueError("Missing Jira key after --jira flag")
                config.jira_key = args[i + 1]
                i += 2
            elif arg == '--baseline':
                if i + 1 >= len(args):
                    raise ValueError("Missing baseline URL after --baseline flag")
                config.predecessor_baseline_url = args[i + 1]
                i += 2
            elif arg == '--repo-baseline':
                if i + 1 >= len(args):
                    raise ValueError("Missing repository baseline URL after --repo-baseline flag")
                config.repository_baseline_url = args[i + 1]
                i += 2
            elif arg == '--commit':
                if i + 2 >= len(args):
                    raise ValueError("Missing commit ID and URL after --commit flag. Usage: --commit <commit_id> <commit_url>")
                config.commit_id = args[i + 1]
                config.commit_url = args[i + 2]
                i += 3
            elif arg == '--tag':
                if i + 2 >= len(args):
                    raise ValueError("Missing tag name and URL after --tag flag. Usage: --tag <tag_name> <tag_url>")
                config.tag_name = args[i + 1]
                config.tag_url = args[i + 2]
                i += 3
            elif arg == '--branch':
                if i + 2 >= len(args):
                    raise ValueError("Missing branch name and URL after --branch flag. Usage: --branch <branch_name> <branch_url>")
                config.branch_name = args[i + 1]
                config.branch_url = args[i + 2]
                i += 3
            elif arg == '--binary-path':
                if i + 1 >= len(args):
                    raise ValueError("Missing binary path after --binary-path flag")
                config.binary_path = args[i + 1]
                i += 2
            elif arg == '--tool-links':
                if i + 1 >= len(args):
                    raise ValueError("Missing tool link after --tool-links flag")
                config.tool_links = args[i + 1]
                i += 2
            elif arg == '--int-test-links':
                if i + 1 >= len(args):
                    raise ValueError("Missing link after --int-test-links flag")
                config.int_test_links = args[i + 1]
                i += 2
            elif not arg.startswith('--'):
                # Assume it's a date
                if config.date is not None:
                    raise ValueError(f"Multiple date arguments: '{config.date}' and '{arg}'")
                config.date = arg
                i += 1
            else:
                raise ValueError(f"Unknown flag: {arg}")

        # Validate that at least one update is specified
        if not any([config.date, config.jira_key,
                   config.predecessor_baseline_url, config.repository_baseline_url,
                   config.commit_id, config.tag_name, config.branch_name, config.tool_links, config.int_test_links]):
            raise ValueError("No updates specified")

        return page_input, config

    @staticmethod
    def validate_config(config: UpdateConfig):
        """Validate the update configuration"""
        # Validate date format
        if config.date:
            try:
                datetime.strptime(config.date, '%Y-%m-%d')
            except ValueError:
                raise ValueError(f"Invalid date format: {config.date}. Use YYYY-MM-DD")

        # Validate Jira key format
        if config.jira_key:
            if not re.match(r'^[A-Z]+-[0-9]+$', config.jira_key):
                raise ValueError(f"Invalid Jira key format: {config.jira_key}")

        # Validate predecessor baseline URL
        if config.predecessor_baseline_url:
            if not (config.predecessor_baseline_url.startswith('http') and
                   'display' in config.predecessor_baseline_url):
                raise ValueError(f"Invalid predecessor baseline URL: {config.predecessor_baseline_url}")

        # Validate repository baseline URL
        if config.repository_baseline_url:
            if not (config.repository_baseline_url.startswith('http') and
                   'sourcecode' in config.repository_baseline_url):
                raise ValueError(f"Invalid repository baseline URL: {config.repository_baseline_url}")

        # Validate commit parameters - both ID and URL must be provided together
        if config.commit_id and not config.commit_url:
            raise ValueError("Commit URL is required when commit ID is provided")
        if config.commit_url and not config.commit_id:
            raise ValueError("Commit ID is required when commit URL is provided")

        # Validate commit URL format
        if config.commit_url:
            if not (config.commit_url.startswith('http') and 'sourcecode' in config.commit_url and 'commits' in config.commit_url):
                raise ValueError(f"Invalid commit URL format: {config.commit_url}")

        # Validate commit ID format (should be a 40-character hex string)
        if config.commit_id:
            if not re.match(r'^[a-f0-9]{40}$', config.commit_id):
                raise ValueError(f"Invalid commit ID format: {config.commit_id}. Should be 40-character hexadecimal string")

        # Validate tag parameters - both name and URL must be provided together
        if config.tag_name and not config.tag_url:
            raise ValueError("Tag URL is required when tag name is provided")
        if config.tag_url and not config.tag_name:
            raise ValueError("Tag name is required when tag URL is provided")

        # Validate tag URL format
        if config.tag_url:
            if not (config.tag_url.startswith('http') and 'sourcecode' in config.tag_url):
                raise ValueError(f"Invalid tag URL format: {config.tag_url}")

        # Validate branch parameters - both name and URL must be provided together
        if config.branch_name and not config.branch_url:
            raise ValueError("Branch URL is required when branch name is provided")
        if config.branch_url and not config.branch_name:
            raise ValueError("Branch name is required when branch URL is provided")

        # Validate branch URL format
        if config.branch_url:
            if not (config.branch_url.startswith('http') and 'sourcecode' in config.branch_url):
                raise ValueError(f"Invalid branch URL format: {config.branch_url}")

        # Validate tool links (basic validation - should be a string)
        if config.tool_links:
            if not isinstance(config.tool_links, str) or len(config.tool_links.strip()) == 0:
                raise ValueError("Tool links must be a non-empty string")

        # Validate INT test links (basic validation - should be a string)
        if config.int_test_links:
            if not isinstance(config.int_test_links, str) or len(config.int_test_links.strip()) == 0:
                raise ValueError("INT test links must be a non-empty string")

    @staticmethod
    def _show_usage():
        """Display usage information"""
        print("Usage:")
        print("  python3 update_gwm_precise.py <confluence_url> [date] [--jira key] [--baseline url] [--repo-baseline url] [--commit id url] [--tag name url] [--branch name url] [--binary-path path] [--tool-links link] [--int-test-links link]")
        print()
        print("Examples:")
        print("  Date only:")
        print("    python3 update_gwm_precise.py 'https://...display/EBR/Page' '2025-09-25'")
        print("  Repository Baseline only:")
        print("    python3 update_gwm_precise.py 'https://...display/EBR/Page' --repo-baseline 'https://sourcecode06.../V9'")
        print("  Commit only:")
        print("    python3 update_gwm_precise.py 'https://...display/EBR/Page' --commit abc123def456... 'https://sourcecode06.../commits/abc123def456...'")
        print("  Tag and Branch:")
        print("    python3 update_gwm_precise.py 'https://...display/EBR/Page' --tag GWM_FVE0120_BL02_V8.1 'https://sourcecode06.../commits?until=GWM_FVE0120_BL02_V8.1' --branch 'release/CNGWM_FVE0120_BL02_V8.1' 'https://sourcecode06.../commits?until=refs%2Fheads%2Frelease%2FCNGWM_FVE0120_BL02_V8.1'")
        print("  Binary Path only:")
        print("    python3 update_gwm_precise.py 'https://...display/EBR/Page' --binary-path 'A07G_FVE0120\\BL02\\V8\\Int_test'")
        print("  Tool Links only (replaces 4 Tool Release Info links):")
        print("    python3 update_gwm_precise.py 'https://...display/EBR/Page' --tool-links '\\\\abtvdfs2.de.bosch.com\\ismdfs\\loc\\szh\\DA\\Driving\\SW_TOOL_Release\\MPC3_EVO\\GWM\\FVE0120\\A07G\\BL02\\V8.4'")
        print("  INT Test Links only (replaces 4 INT Test links with \\Int_test suffix):")
        print("    python3 update_gwm_precise.py 'https://...display/EBR/Page' --int-test-links '\\\\abtvdfs2.de.bosch.com\\ismdfs\\loc\\szh\\DA\\Driving\\SW_TOOL_Release\\MPC3_EVO\\GWM\\FVE0120\\A07G\\BL02\\V8.4'")
        print("  Both Tool and INT Test Links:")
        print("    python3 update_gwm_precise.py 'https://...display/EBR/Page' --tool-links '\\\\abtvdfs2.de.bosch.com\\ismdfs\\loc\\szh\\DA\\Driving\\SW_TOOL_Release\\MPC3_EVO\\GWM\\FVE0120\\A07G\\BL02\\V8.4' --int-test-links '\\\\abtvdfs2.de.bosch.com\\ismdfs\\loc\\szh\\DA\\Driving\\SW_TOOL_Release\\MPC3_EVO\\GWM\\FVE0120\\A07G\\BL02\\V8.4'")
        print("  Multiple updates:")
        print("    python3 update_gwm_precise.py 'https://...display/EBR/Page' '2025-09-25' --jira MPCTEGWMA-3000 --commit abc123def456... 'https://sourcecode06.../commits/abc123def456...' --tag GWM_FVE0120_BL02_V8.1 'https://sourcecode06.../commits?until=GWM_FVE0120_BL02_V8.1' --tool-links '\\\\abtvdfs2.de.bosch.com\\ismdfs\\loc\\szh\\DA\\Driving\\SW_TOOL_Release\\MPC3_EVO\\GWM\\FVE0120\\A07G\\BL02\\V8.4'")

# ============================================================================
# MAIN APPLICATION
# ============================================================================
def main():
    """Main application logic"""
    try:
        # Parse and validate arguments
        page_input, config = ArgumentParser.parse_arguments(sys.argv)
        ArgumentParser.validate_config(config)

        # Show what we're going to update
        print("🚀 Starting precise update")
        print(f"📄 Page input: {page_input}")
        if config.date:
            print(f"📅 New date: {config.date}")
        if config.jira_key:
            print(f"🎫 New Jira key: {config.jira_key}")
        if config.predecessor_baseline_url:
            print(f"🔗 New predecessor baseline URL: {config.predecessor_baseline_url}")
        if config.repository_baseline_url:
            print(f"📂 New repository baseline URL: {config.repository_baseline_url}")
        if config.commit_id:
            print(f"💾 New commit ID: {config.commit_id}")
            print(f"🔗 New commit URL: {config.commit_url}")
        if config.tag_name:
            print(f"🏷️  New tag name: {config.tag_name}")
            print(f"🔗 New tag URL: {config.tag_url}")
        if config.branch_name:
            print(f"🌿 New branch name: {config.branch_name}")
            print(f"🔗 New branch URL: {config.branch_url}")
        if config.binary_path:
            print(f"📁 New binary path: {config.binary_path}")
        if config.tool_links:
            print(f"🔧 New tool links: {config.tool_links}")
        if config.int_test_links:
            print(f"🧪 New INT test links: {config.int_test_links}")
        print()

        # Initialize Confluence client
        client = ConfluenceClient()

        # Get page ID from URL or use directly if it's already an ID
        if page_input.startswith('http') and 'display' in page_input:
            page_id = client.get_page_id_from_url(page_input)
        elif page_input.isdigit():
            page_id = page_input
        else:
            raise ValueError("Input must be either a Confluence URL or numeric page ID")

        # Get current page
        page_data = client.get_page(page_id)
        current_version = page_data['version']['number']
        current_content = page_data['body']['storage']['value']
        title = page_data['title']

        print(f"📖 Page: {title}")
        print()

        # Perform updates
        updated_content = current_content
        changes_made = False
        results = {}

        updater = ContentUpdater()

        # Update release date
        if config.date:
            result = updater.update_release_date(updated_content, config.date)
            if result.success:
                updated_content = re.sub(PATTERNS['release_date'],
                                       f'\\g<1>{config.date}\\g<3>', updated_content)
                changes_made = True
                results['date'] = result
                print("✅ Date update successful")
            else:
                print(f"⚠️  Date update failed: {result.error}")

        # Update Jira ticket
        if config.jira_key:
            result = updater.update_jira_ticket(updated_content, config.jira_key)
            if result.success:
                updated_content = re.sub(PATTERNS['jira_ticket'],
                                       f'\\g<1>{config.jira_key}\\g<3>', updated_content)
                changes_made = True
                results['jira'] = result
                print("✅ Jira key update successful")
            else:
                print(f"⚠️  Jira key update failed: {result.error}")

        # Update predecessor baseline
        if config.predecessor_baseline_url:
            result = updater.update_predecessor_baseline(updated_content, config.predecessor_baseline_url)
            if result.success:
                new_display_text = updater._extract_page_title_from_url(config.predecessor_baseline_url)
                updated_content = re.sub(PATTERNS['predecessor_baseline'],
                                       f'\\g<1>{config.predecessor_baseline_url}\\g<3>{new_display_text}\\g<5>',
                                       updated_content)
                changes_made = True
                results['predecessor_baseline'] = result
                print("✅ Predecessor baseline update successful")
            else:
                print(f"⚠️  Predecessor baseline update failed: {result.error}")

        # Update repository baseline
        if config.repository_baseline_url:
            result = updater.update_repository_baseline(updated_content, config.repository_baseline_url)
            if result.success:
                updated_content = re.sub(PATTERNS['repository_baseline'],
                                       f'\\g<1>{config.repository_baseline_url}\\g<3>{config.repository_baseline_url}\\g<5>',
                                       updated_content)
                changes_made = True
                results['repository_baseline'] = result
                print("✅ Repository baseline update successful")
            else:
                print(f"⚠️  Repository baseline update failed: {result.error}")

        # Update commit information
        if config.commit_id and config.commit_url:
            result = updater.update_commit_info(updated_content, config.commit_id, config.commit_url)
            if result.success:
                updated_content = re.sub(PATTERNS['commit_link'],
                                       f'\\g<1>{config.commit_url}\\g<3>{config.commit_id}\\g<5>',
                                       updated_content)
                changes_made = True
                results['commit'] = result
                print("✅ Commit information update successful")
            else:
                print(f"⚠️  Commit information update failed: {result.error}")

        # Update tag information
        if config.tag_name and config.tag_url:
            result = updater.update_tag_info(updated_content, config.tag_name, config.tag_url)
            if result.success:
                updated_content = re.sub(PATTERNS['tag_link'],
                                       f'\\g<1>{config.tag_url}\\g<3>{config.tag_name}\\g<5>',
                                       updated_content)
                changes_made = True
                results['tag'] = result
                print("✅ Tag information update successful")
            else:
                print(f"⚠️  Tag information update failed: {result.error}")

        # Update branch information
        if config.branch_name and config.branch_url:
            result = updater.update_branch_info(updated_content, config.branch_name, config.branch_url)
            if result.success:
                updated_content = re.sub(PATTERNS['branch_link'],
                                       f'\\g<1>{config.branch_url}\\g<3>{config.branch_name}\\g<5>',
                                       updated_content)
                changes_made = True
                results['branch'] = result
                print("✅ Branch information update successful")
            else:
                print(f"⚠️  Branch information update failed: {result.error}")
        # Update binary path
        if config.binary_path:
            result = updater.update_binary_path(updated_content, config.binary_path)
            if result.success:
                # Format the binary path properly with HTML if needed
                new_path = config.binary_path
                if not '<a class="external-link"' in new_path:
                    if new_path.startswith('\\\\'):
                        parts = new_path[2:].split('\\', 1)
                        server = parts[0] if len(parts) > 0 else ''
                        remaining_path = '\\' + parts[1] if len(parts) > 1 else ''
                        formatted_binary_path = f'\\\\<a class="external-link" href="http://{server}/">{server}</a>{remaining_path}'
                    else:
                        formatted_binary_path = new_path
                else:
                    formatted_binary_path = new_path

                escaped_binary_path = formatted_binary_path.replace('\\', '\\\\')
                updated_content = re.sub(PATTERNS['binary_path'],
                                       f'\\g<1>{escaped_binary_path}\\g<3>',
                                       updated_content)
                changes_made = True
                results['binary_path'] = result
                print("✅ Binary path update successful")
            else:
                print(f"⚠️  Binary path update failed: {result.error}")

        # Update Tool Release Info links (MEA, ADM, Restbus)
        if config.tool_links:
            result = updater.update_tool_links(updated_content, config.tool_links)
            if result.success:
                # Apply the Tool Release Info updates
                escaped_link = config.tool_links.replace('\\', '\\')
                mea_new_content = f'<p>{escaped_link}</p><p>{escaped_link}</p>'
                adm_new_content = escaped_link
                restbus_new_content = escaped_link

                updated_content = re.sub(PATTERNS['mea_tool_links'], lambda m: f'{m.group(1)}{mea_new_content}{m.group(3)}', updated_content, flags=re.DOTALL)
                updated_content = re.sub(PATTERNS['adm_tool_link'], lambda m: f'{m.group(1)}{adm_new_content}{m.group(3)}', updated_content, flags=re.DOTALL)
                updated_content = re.sub(PATTERNS['restbus_tool_link'], lambda m: f'{m.group(1)}{restbus_new_content}{m.group(3)}', updated_content, flags=re.DOTALL)

                changes_made = True
                results['tool_links'] = result
                print("✅ Tool Release Info links update successful")
            else:
                print(f"⚠️  Tool links update failed: {result.error}")

        # Update INT Test links separately
        if config.int_test_links:
            result = updater.update_int_test_links(updated_content, config.int_test_links)
            if result.success:
                # Apply the INT Test updates - call the method to do the actual replacement
                escaped_link = config.int_test_links.replace('\\', '\\\\')
                escaped_link_with_int_test = escaped_link + '\\\\Int_test'
                int_test_replacement = f'{escaped_link_with_int_test}'

                updated_content = re.sub(PATTERNS['int_test_links'], int_test_replacement, updated_content)

                changes_made = True
                results['int_test_links'] = result
                print("✅ INT Test links update successful")
            else:
                print(f"⚠️  INT Test links update failed: {result.error}")

        if not changes_made:
            print("⚠️  No changes made - could not find or update the requested fields")
            sys.exit(1)

        # Update the page
        result = client.update_page(page_id, title, updated_content, current_version)

        # Show success summary
        print()
        print("🎉 Success!")
        print(f"✅ Page updated to version {result['version']['number']}")

        if 'date' in results:
            print(f"📅 Release date changed to: {config.date}")
        if 'jira' in results:
            r = results['jira']
            print(f"🎫 Jira key changed from: {r.old_value} → {r.new_value}")
        if 'predecessor_baseline' in results:
            r = results['predecessor_baseline']
            print(f"🔗 Predecessor baseline changed from: {r.old_value} → {r.new_value}")
        if 'repository_baseline' in results:
            r = results['repository_baseline']
            print(f"📂 Repository baseline changed from: {r.old_value} → {r.new_value}")
        if 'commit' in results:
            r = results['commit']
            print(f"💾 Commit changed from: {r.old_value} → {r.new_value}")
        if 'tag' in results:
            r = results['tag']
            print(f"🏷️  Tag changed from: {r.old_value} → {r.new_value}")
        if 'branch' in results:
            r = results['branch']
            print(f"🌿 Branch changed from: {r.old_value} → {r.new_value}")
        if 'tool_links' in results:
            r = results['tool_links']
            print(f"🔧 Tool Release Info links changed from: {r.old_value} → {r.new_value}")
            print(f"   - MEA: 2 links updated")
            print(f"   - ADM: 1 link updated")
            print(f"   - Restbus: 1 link updated")
        if 'int_test_links' in results:
            r = results['int_test_links']
            print(f"🧪 INT Test links changed from: {r.old_value} → {r.new_value}")
            print(f"   - 4 links updated (with \\Int_test suffix)")

    except Exception as e:
        print(f"💥 Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()