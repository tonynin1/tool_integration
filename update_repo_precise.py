#!/usr/bin/env python3
"""
Update repository baseline information for GWM Confluence pages specifically
"""

import re

def update_repository_baseline_gwm(content, new_repo_url, new_commit_hash, new_tag, new_branch):
    """Update repository baseline information specifically for GWM pages"""
    print(f"🔧 Looking for GWM repository baseline references...")

    print(f"📝 New repository URL: {new_repo_url}")
    print(f"📝 New commit hash: {new_commit_hash}")
    print(f"📝 New tag: {new_tag}")
    print(f"📝 New branch: {new_branch}")

    changes_made = False
    updated_content = content

    # Pattern 1: Repository URL with full URL in href and display text
    repo_pattern = r'(Repository: <a href=")([^"]*sourcecode06\.dev\.bosch\.com[^"]*)(">)([^<]*)(</a>)'
    repo_match = re.search(repo_pattern, updated_content)

    if repo_match:
        old_repo_url = repo_match.group(2)
        old_repo_text = repo_match.group(4)
        print(f"✅ Found repository URL:")
        print(f"   - Current href: {old_repo_url}")
        print(f"   - Current text: {old_repo_text}")
        print(f"   - New href: {new_repo_url}")
        print(f"   - New text: {new_repo_url}")

        # Update both href and display text
        updated_content = re.sub(
            repo_pattern,
            f'\\g<1>{new_repo_url}\\g<3>{new_repo_url}\\g<5>',
            updated_content
        )
        changes_made = True
    else:
        print("❌ Repository URL pattern not found")

    # Pattern 2: Commit hash
    commit_pattern = r'(Commit: <a href=")([^"]*sourcecode06\.dev\.bosch\.com[^"]*commits/)([a-f0-9]+)(">[a-f0-9]+</a>)'
    commit_match = re.search(commit_pattern, updated_content)

    if commit_match:
        old_commit_base_url = commit_match.group(2)
        old_commit_hash = commit_match.group(3)
        print(f"✅ Found commit hash:")
        print(f"   - Current: {old_commit_hash}")
        print(f"   - New: {new_commit_hash}")

        # Update commit hash in both URL and display text
        new_commit_url = f"{old_commit_base_url}{new_commit_hash}"
        updated_content = re.sub(
            commit_pattern,
            f'\\g<1>{new_commit_url}\\g<4>{new_commit_hash}</a>',
            updated_content
        )
        changes_made = True
    else:
        print("❌ Commit hash pattern not found")

    # Pattern 3: Tag
    tag_pattern = r'(Tag: <a href=")([^"]*sourcecode06\.dev\.bosch\.com[^"]*commits\?until=)([^"]+)(">)([^<]+)(</a>)'
    tag_match = re.search(tag_pattern, updated_content)

    if tag_match:
        old_tag_base_url = tag_match.group(2)
        old_tag_param = tag_match.group(3)
        old_tag_text = tag_match.group(5)
        print(f"✅ Found tag:")
        print(f"   - Current: {old_tag_text}")
        print(f"   - New: {new_tag}")

        # Update tag in both URL and display text
        new_tag_url = f"{old_tag_base_url}{new_tag}"
        updated_content = re.sub(
            tag_pattern,
            f'\\g<1>{new_tag_url}\\g<4>{new_tag}\\g<6>',
            updated_content
        )
        changes_made = True
    else:
        print("❌ Tag pattern not found")

    # Pattern 4: Branch
    branch_pattern = r'(Branch: <a href=")([^"]*sourcecode06\.dev\.bosch\.com[^"]*commits\?until=refs%2Fheads%2F)([^"]+)(">)([^<]+)(</a>)'
    branch_match = re.search(branch_pattern, updated_content)

    if branch_match:
        old_branch_base_url = branch_match.group(2)
        old_branch_param = branch_match.group(3)
        old_branch_text = branch_match.group(5)
        print(f"✅ Found branch:")
        print(f"   - Current: {old_branch_text}")
        print(f"   - New: {new_branch}")

        # Update branch in both URL and display text
        new_branch_encoded = new_branch.replace('/', '%2F')
        new_branch_url = f"{old_branch_base_url}{new_branch_encoded}"
        updated_content = re.sub(
            branch_pattern,
            f'\\g<1>{new_branch_url}\\g<4>{new_branch}\\g<6>',
            updated_content
        )
        changes_made = True
    else:
        print("❌ Branch pattern not found")

    if changes_made:
        print("✅ Repository baseline update successful")
        return updated_content, True
    else:
        print("⚠️  Repository baseline update failed - no patterns found")
        return content, False

if __name__ == "__main__":
    # Test the patterns with sample content
    sample_content = '''
    Repository: <a href="https://sourcecode06.dev.bosch.com/projects/G3N/repos/fvg3_lfs/commits?until=refs%2Fheads%2Frelease%2FCNGWM_FVE0120_BL02_V6">https://sourcecode06.dev.bosch.com/projects/G3N/repos/fvg3_lfs/commits?until=refs%2Fheads%2Frelease%2FCNGWM_FVE0120_BL02_V6</a>
    Commit: <a href="https://sourcecode06.dev.bosch.com/projects/G3N/repos/fvg3_lfs/commits/4726844af4674384c745e3d4110ed74031d603c0">4726844af4674384c745e3d4110ed74031d603c0</a>
    Tag: <a href="https://sourcecode06.dev.bosch.com/projects/G3N/repos/fvg3_lfs/commits?until=GWM_FVE0120_BL02_V6">GWM_FVE0120_BL02_V6</a>
    Branch: <a href="https://sourcecode06.dev.bosch.com/projects/G3N/repos/fvg3_lfs/commits?until=refs%2Fheads%2Frelease%2FCNGWM_FVE0120_BL02_V6">release/CNGWM_FVE0120_BL02_V6</a>
    '''

    new_repo_url = "https://sourcecode06.dev.bosch.com/projects/G3N/repos/fvg3_lfs/commits?until=refs%2Fheads%2Frelease%2FCNGWM_FVE0120_BL02_V8.1"
    new_commit_hash = "bcb3c16cbed69c47286b2a111b0bb07e26da3f1d"
    new_tag = "GWM_FVE0120_BL02_V8.1"
    new_branch = "release/CNGWM_FVE0120_BL02_V8.1"

    result, success = update_repository_baseline_gwm(sample_content, new_repo_url, new_commit_hash, new_tag, new_branch)

    if success:
        print("\n" + "="*60)
        print("UPDATED CONTENT:")
        print("="*60)
        print(result)
    else:
        print("Failed to update content")