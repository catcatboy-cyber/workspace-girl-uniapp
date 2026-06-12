"""Batch replace raw font-size and font-weight with SCSS tokens."""
import re, os, sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

FS_MAP = {
    '56rpx': '$fs-display',
    '48rpx': '$fs-hero-title',
    '44rpx': '$fs-hero-title',
    '40rpx': '$fs-kpi',
    '38rpx': '$fs-kpi',
    '36rpx': '$fs-kpi',
    '34rpx': '$fs-kpi',
    '32rpx': '$fs-heading',
    '30rpx': '$fs-heading',
    '28rpx': '$fs-heading',
    '26rpx': '$fs-body-lg',
    '24rpx': '$fs-body-lg',
    '22rpx': '$fs-body',
    '21rpx': '$fs-body',
    '20rpx': '$fs-caption',
    '19rpx': '$fs-caption',
    '18rpx': '$fs-caption',
    '16rpx': '$fs-micro',
    '14rpx': '$fs-micro',
    '58rpx': '$fs-display',
    '27rpx': '$fs-body-lg',
}

FW_MAP = {
    '900': '$fw-hero',
    '800': '$fw-hero',
    '700': '$fw-label',
    '600': '$fw-body',
}

PAGES = [
    # Phase 2 — already done: new, about, explain, reassess, feedback, token-recharge, custom-pet, login, system-tracks, token-usage, register
    # Phase 4-5 — remaining pages with raw font-size values
    'src/pages/ai-settings/ai-settings.vue',
    'src/pages/assessments/assessments.vue',
    'src/pages/case-detail/case-detail.vue',
    'src/pages/cases/cases.vue',
    'src/pages/edit-profile/edit-profile.vue',
    'src/pages/index/index.vue',
    'src/pages/me/me.vue',
    'src/pages/references/references.vue',
    'src/pages/self-profile/self-profile.vue',
    'src/pages/subscription/subscription.vue',
    'src/pages/taohua-share/taohua-share.vue',
    'src/pages/taohua/taohua.vue',
    'src/pages/timeline/timeline.vue',
    'src/pages/weekly-review/weekly-review.vue',
]

# Additional line-height map (standardize to 5 values)
LH_MAP = {
    'line-height: 1.55': 'line-height: $lh-loose',
    'line-height: 1.6': 'line-height: $lh-loose',
    'line-height: 1.35': 'line-height: $lh-heading',
    'line-height: 1.2': 'line-height: $lh-heading',
    'line-height: 1.15': 'line-height: $lh-hero',
    'line-height: 1.1': 'line-height: $lh-hero',
}

for relpath in PAGES:
    filepath = os.path.join(BASE, relpath)
    if not os.path.exists(filepath):
        print(f'SKIP (not found): {relpath}')
        continue

    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content

    # 1. Add lang="scss"
    content = content.replace('<style scoped>', '<style scoped lang="scss">')

    # 2. Replace font-size
    for old_val, new_val in sorted(FS_MAP.items(), key=lambda x: -len(x[0])):
        content = re.sub(
            r'font-size:\s*' + re.escape(old_val),
            'font-size: ' + new_val,
            content
        )

    # 3. Replace font-weight
    for old_val, new_val in sorted(FW_MAP.items(), key=lambda x: -len(x[0])):
        content = re.sub(
            r'font-weight:\s*' + re.escape(old_val),
            'font-weight: ' + new_val,
            content
        )

    # 4. Replace line-height (standardize)
    for old_val, new_val in LH_MAP.items():
        content = content.replace(old_val, new_val)

    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        n_fs = len(re.findall(r'font-size:\s*\$fs-', content))
        n_fw = len(re.findall(r'font-weight:\s*\$fw-', content))
        print(f'OK  {relpath}  ({n_fs} fs, {n_fw} fw → token)')
    else:
        print(f'--  {relpath}  (no changes)')

print('Done.')
