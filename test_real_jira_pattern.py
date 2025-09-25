#!/usr/bin/env python3
"""Test script to verify Jira pattern with real HTML structure"""

import re

def test_real_jira_pattern():
    # Real HTML structure from the user
    test_content = '''<td style="text-align: left;" class="confluenceTd"><div class="content-wrapper"><p><span class="jira-issue conf-macro output-block" data-jira-key="MPCTEGWMA-2216" data-client-id="SINGLE_f932e1e2-f923-3db3-a1ba-7cd9abe7428e_6283400128_8aba63999694dbe20196a9a367cb0044" data-hasbody="false" data-macro-name="jira">
                    <a href="https://rb-tracker.bosch.com/tracker08/browse/MPCTEGWMA-2216" class="jira-issue-key"><span class="aui-icon aui-icon-wait issue-placeholder"></span>MPCTEGWMA-2216</a>'''

    print("🧪 Testing Real Jira pattern matching...")
    print("Test content structure found!")
    print()

    # Pattern to match the entire Jira block
    pattern = r'(data-jira-key=")([A-Z]+-[0-9]+)("[^>]*>[^<]*<a href="[^"]*browse/)([A-Z]+-[0-9]+)("[^>]*>[^<]*>)([A-Z]+-[0-9]+)(</a>)'

    match = re.search(pattern, test_content, re.DOTALL)

    if match:
        old_jira_key = match.group(2)
        old_url_key = match.group(4)
        old_text_key = match.group(6)

        print(f"✅ Found Jira references:")
        print(f"   - data-jira-key: {old_jira_key}")
        print(f"   - URL key: {old_url_key}")
        print(f"   - Text key: {old_text_key}")

        # Test replacement
        new_jira_key = "MPCTEGWMA-3000"
        updated_content = re.sub(
            pattern,
            f'\\g<1>{new_jira_key}\\g<3>\\g<4>{new_jira_key}\\g<5>{new_jira_key}\\g<7>',
            test_content,
            flags=re.DOTALL
        )

        print(f"🔄 Updating all to: {new_jira_key}")
        print()
        print("Updated content:")
        print(updated_content)

        # Verify all updates
        if new_jira_key in updated_content:
            count = updated_content.count(new_jira_key)
            print(f"✅ Verification: Found {count} instances of {new_jira_key}")
        else:
            print("❌ Verification failed")
    else:
        print("❌ Complex pattern not found, trying simple pattern...")

        # Try simple pattern
        simple_pattern = r'(data-jira-key=")([A-Z]+-[0-9]+)(")'
        simple_match = re.search(simple_pattern, test_content)

        if simple_match:
            old_jira_key = simple_match.group(2)
            print(f"✅ Found data-jira-key: {old_jira_key}")

            # Test simple replacement
            new_jira_key = "MPCTEGWMA-3000"
            updated_content = re.sub(simple_pattern, f'\\g<1>{new_jira_key}\\g<3>', test_content)
            print(f"🔄 Updated data-jira-key to: {new_jira_key}")
            print()
            print("Updated content (partial):")
            print(updated_content[:200] + "...")
        else:
            print("❌ No pattern found")

if __name__ == "__main__":
    test_real_jira_pattern()