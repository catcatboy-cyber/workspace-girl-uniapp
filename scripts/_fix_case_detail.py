"""Fix case-detail JS: remove pair code, add goTaohuaMatch."""
path = 'src/pages/case-detail/case-detail.vue'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Remove generatePairRead from import
content = content.replace(', generatePairRead', '')

# 2. Remove loadPairMatch() call
content = content.replace('  await loadPairMatch()\n', '')
content = content.replace('  loadPairMatch()\n', '')

# 3. Remove import of zodiacSignMatch/generatePairInsight if present
content = content.replace("import { zodiacSignMatch, generatePairInsight } from '@/utils/taohua'\n", '')

# 4. Replace JS from goSelfProfile to end of doPairAIDeepRead
old_start = content.find('function goSelfProfile()')
old_end = content.find('pairReadLoading.value = false', old_start)
old_end = content.find('\n}', old_end) + 2

new_code = 'function goTaohuaMatch() {\n  const crush = caseFile.value?.profile\n  const z = crush?.zodiac || \'\'\n  const s = crush?.constellation || \'\'\n  uni.navigateTo({ url: \'/pages/taohua/taohua?matchZodiac=\' + encodeURIComponent(z) + \'&matchSign=\' + encodeURIComponent(s) })\n}\n'

content = content[:old_start] + new_code + content[old_end:]

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Done')
