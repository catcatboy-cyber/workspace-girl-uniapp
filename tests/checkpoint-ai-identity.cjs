// ===== Smoke & regression checkpoint tests for nickname-avatar + AI identity =====

let pass = 0, fail = 0
function check(label, condition) {
  if (condition) { pass++; return }
  fail++; console.error('  FAIL:', label)
}

// ==========================================
// Checkpoint 1: wechatLogin avatarUrl fallback (R1)
// ==========================================
console.log('\n=== C1: wechatLogin avatarUrl fallback ===')
const wl = require('fs').readFileSync('cloudfunctions/wechatLogin/index.js', 'utf8')

// Verify fallback chain in returned avatarUrl
check('avatarUrl has selfProfile.avatarUrl fallback',
  wl.includes("user.avatarUrl || (user.selfProfile && user.selfProfile.avatarUrl) || ''"))
console.log('  Result: %d/%d PASS', pass, pass + fail)
const c1ok = fail === 0
pass = 0; fail = 0

// ==========================================
// Checkpoint 2: serializeSelfProfile has nickname (R2C-1)
// ==========================================
console.log('\n=== C2: serializeSelfProfile +nickname ===')
const ae = require('fs').readFileSync('cloudfunctions/_shared/ai-event.js', 'utf8')

check('serializeSelfProfile has nickname field',
  ae.includes('nickname: profile.nickname'))
check('nickname is FIRST field in normalized object',
  /normalized\s*=\s*\{[\s\n]*nickname:/.test(ae))
console.log('  Result: %d/%d PASS', pass, pass + fail)
const c2ok = fail === 0
pass = 0; fail = 0

// ==========================================
// Checkpoint 3: Identity context line (R2C-2) — v3 priority
// ==========================================
console.log('\n=== C3: Identity context line priority ===')

// Extract the Identity line
const identityMatch = ae.match(/`Identity:.*?`/)
const identityLine = identityMatch ? identityMatch[0] : ''
check('Identity line exists', identityLine.length > 0)
check('USER priority: event.chatSelfName BEFORE selfProfile.nickname',
  identityLine.includes('event?.chatSelfName') && ae.includes('event?.chatSelfName'))
check('CRUSH priority: event.chatTargetName BEFORE caseName',
  identityLine.includes('event?.chatTargetName') && ae.includes('caseName'))
check('Fallback: "用户" for USER', identityLine.includes("用户'"))
check('Fallback: "TA" for CRUSH', identityLine.includes("TA'"))
console.log('  Result: %d/%d PASS', pass, pass + fail)
const c3ok = fail === 0
pass = 0; fail = 0

// ==========================================
// Checkpoint 4: compactTimelineItem + compactRecentTimeline (R2C-3a+b)
// ==========================================
console.log('\n=== C4: compactTimelineItem/compactRecentTimeline +chatNames ===')
const gaa = require('fs').readFileSync('cloudfunctions/generateAssessmentAI/index.js', 'utf8')

// generateAssessmentAI compactTimelineItem
check('compactTimelineItem has chatSelfName with trim().slice(0,30)',
  gaa.includes("chatSelfName: typeof item.chatSelfName === 'string' ? item.chatSelfName.trim().slice(0, 30)"))
check('compactTimelineItem has chatTargetName with trim().slice(0,30)',
  gaa.includes("chatTargetName: typeof item.chatTargetName === 'string' ? item.chatTargetName.trim().slice(0, 30)"))

// ai-event.js compactRecentTimeline
check('compactRecentTimeline has chatSelfName',
  ae.includes('chatSelfName: item.chatSelfName'))
check('compactRecentTimeline has chatTargetName',
  ae.includes('chatTargetName: item.chatTargetName'))
console.log('  Result: %d/%d PASS', pass, pass + fail)
const c4ok = fail === 0
pass = 0; fail = 0

// ==========================================
// Checkpoint 5: caseName pass-through chain (R2C-4)
// ==========================================
console.log('\n=== C5: caseName pass-through chain ===')
const er = require('fs').readFileSync('cloudfunctions/_shared/event-recalculate.js', 'utf8')

check('generateAssessmentAI defines caseName from caseDoc.name',
  gaa.includes('const caseName = caseDoc.name'))
check('generateAssessmentAI passes caseName to recalculateAssessmentFromEvent',
  gaa.includes('caseName,') && gaa.includes('selfProfile,'))
check('event-recalculate destructures caseName from params',
  er.includes('caseName,'))
check('event-recalculate passes caseName to analyzeTimelineEvent',
  er.includes('caseName,') && er.includes('selfProfile,'))
console.log('  Result: %d/%d PASS', pass, pass + fail)
const c5ok = fail === 0
pass = 0; fail = 0

// ==========================================
// Checkpoint 6: index.vue template (R2A+B)
// ==========================================
console.log('\n=== C6: index.vue template ===')
const idx = require('fs').readFileSync('src/pages/index/index.vue', 'utf8')

// Conditional compilation
const ifdefCount = (idx.match(/#ifdef\s+MP-WEIXIN/g) || []).length
const ifndefCount = (idx.match(/#ifndef\s+MP-WEIXIN/g) || []).length
const endifCount = (idx.match(/#endif/g) || []).length
check('#ifdef/#ifndef/#endif balanced', ifdefCount + ifndefCount === endifCount)

// type=nickname for WeChat
check('MP-WEIXIN uses type="nickname"', idx.includes('type="nickname"'))
check('non-MP uses type="text"', idx.includes('type="text"'))

// Hint stays inside v-if
const hintIdx = idx.indexOf('贴对话后标注')
const vifMatch = idx.slice(Math.max(0, hintIdx - 200)).indexOf('v-if="quickSubjectRole')
check('hint is inside v-if="both"', vifMatch > 0 && hintIdx - vifMatch < 200)

// Auto-fill logic
check('onQuickRecordAction auto-fills quickChatSelfName',
  idx.includes('getCachedSelfProfile()') && idx.includes('quickChatSelfName.value = cached.nickname'))
check('does not overwrite manual edit', idx.includes('!quickChatSelfName.value'))
console.log('  Result: %d/%d PASS', pass, pass + fail)
const c6ok = fail === 0

// ==========================================
// Summary
// ==========================================
console.log('\n=== SMOKE TEST SUMMARY ===')
const allOk = c1ok && c2ok && c3ok && c4ok && c5ok && c6ok
if (allOk) {
  console.log('All 6 checkpoints PASS')
  process.exit(0)
} else {
  console.error('FAILED checkpoints:',
    [!c1ok && 'C1', !c2ok && 'C2', !c3ok && 'C3', !c4ok && 'C4', !c5ok && 'C5', !c6ok && 'C6'].filter(Boolean).join(', '))
  process.exit(1)
}
