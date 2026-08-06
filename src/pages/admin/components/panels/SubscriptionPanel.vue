<template>
  <view class="panel">
    <view class="panel-head">
      <view>
        <text class="panel-title">订阅配置</text>
        <text class="panel-meta">管理试用期、三档套餐、分享奖励。修改即时生效，无需发版。</text>
      </view>
    </view>

    <!-- 试用期 -->
    <view class="switch-row">
      <view>
        <text class="field-title">免费试用期</text>
        <text class="field-desc">新用户注册后享有全功能不限次体验。关闭后新用户直接进入免费版。</text>
      </view>
      <switch :checked="subForm.trialEnabled" @change="subForm.trialEnabled = $event.detail.value" />
    </view>
    <view v-if="subForm.trialEnabled" class="form-grid">
      <view class="field">
        <text>试用天数</text>
        <input v-model.number="subForm.trialDurationDays" type="number" placeholder="7" />
      </view>
      <view class="field">
        <text>邀请延长天数</text>
        <input v-model.number="subForm.trialExtendOnReferral" type="number" placeholder="3" />
      </view>
    </view>
    <view v-if="subForm.trialEnabled" style="margin-top:12rpx;">
      <text style="font-size:22rpx;color:#999;font-weight:700;display:block;margin-bottom:8rpx;">试用期可用功能（点击切换）</text>
      <view style="display:flex;flex-wrap:wrap;gap:8rpx;">
        <view
          v-for="f in ALL_FEATURES"
          :key="'trial_' + f"
          :class="['chip-v2', hasTrialFeature(f) ? 'active' : '']"
          style="padding:6rpx 16rpx;font-size:20rpx;"
          @click="toggleTrialFeature(f)"
        >{{ hasTrialFeature(f) ? '✓' : '✗' }} {{ featureDisplayLabel(f) }}</view>
      </view>
    </view>

    <view class="note-text" style="padding:12rpx 0;color:#999;font-size:22rpx;">
      倍率 → 「Crush Credits 额度」tab 的模型扣费倍率 · 新用户赠送 → 「Crush Credits 额度」tab 的首次赠送额度 · 加油包 → 「Crush Credits 额度」tab 的充值档位
    </view>

    <view class="settings-section">
      <view class="section-head">
        <text class="section-title">心动人设局单次解锁</text>
        <text class="section-desc">固定使用 short_series_goods，道具 0001，价格 199 分；这里仅配置是否开放、现网道具 ID 和允许的测试类型。</text>
      </view>
      <view class="switch-row">
        <view><text class="field-title">开启先答题后付费</text><text class="field-desc">关闭后，免费用户不能进入这三个测试；订阅权限仍按 features / excludedFeatures 判断。</text></view>
        <switch :checked="subForm.heartPersona.enabled && subForm.heartPersona.answerBeforePayEnabled" @change="subForm.heartPersona.enabled = $event.detail.value; subForm.heartPersona.answerBeforePayEnabled = $event.detail.value" />
      </view>
      <view class="form-grid">
        <view class="field"><text>沙箱道具 ID（固定）</text><input value="0001" disabled /></view>
        <view class="field"><text>价格（固定，分）</text><input value="199" disabled /></view>
        <view class="field wide"><text>现网道具 ID</text><input v-model="subForm.heartPersona.productionProductId" placeholder="微信后台发布现网道具后填写" /></view>
      </view>
      <text class="field-desc" style="display:block;margin-top:14rpx;">允许单次解锁的测试（点击切换）</text>
      <view style="display:flex;flex-wrap:wrap;gap:8rpx;margin-top:8rpx;">
        <view v-for="feature in ARCHETYPE_FEATURES" :key="'pay_' + feature" :class="['chip-v2', subForm.heartPersona.allowedFeatures.includes(feature) ? 'active' : '']" style="padding:6rpx 16rpx;font-size:20rpx;" @click="togglePaymentFeature(feature)">
          {{ subForm.heartPersona.allowedFeatures.includes(feature) ? '✓' : '✗' }} {{ featureDisplayLabel(feature) }}
        </view>
      </view>
    </view>

    <!-- 三档套餐 -->
    <view class="settings-section">
      <view class="section-head">
        <text class="section-title">套餐方案</text>
      </view>
      <view v-for="planKey in ['free', 'pro', 'ultra']" :key="planKey" class="model-card">
        <view class="model-head">
          <text class="model-title">{{ subForm.plans[planKey].name || planKey }}</text>
        </view>
        <view class="form-grid">
          <view class="field">
            <text>名称</text>
            <input v-model="subForm.plans[planKey].name" />
          </view>
          <view class="field">
            <text>月度 Crush Credits（-1=不限）</text>
            <input v-model.number="subForm.plans[planKey].monthlyTokens" type="number" placeholder="30000" />
          </view>
          <view class="field">
            <text>Crush 上限（-1=不限）</text>
            <input v-model.number="subForm.plans[planKey].maxCrushes" type="number" placeholder="1" />
          </view>
          <view class="field" v-if="planKey !== 'free'">
            <text>月费 (¥)</text>
            <input v-model.number="subForm.plans[planKey].priceYuan" type="number" placeholder="19" />
          </view>
          <view class="field" v-if="planKey !== 'free'">
            <text>年费 (¥)</text>
            <input v-model.number="subForm.plans[planKey].priceYuanAnnual" type="number" placeholder="168" />
          </view>
          <view class="field" v-if="planKey !== 'free'">
            <text>学生价 (¥/月)</text>
            <input v-model.number="subForm.plans[planKey].priceYuanStudent" type="number" placeholder="12" />
          </view>
          <view class="field" v-if="planKey !== 'free'">
            <text>学生年费 (¥)</text>
            <input v-model.number="subForm.plans[planKey].priceYuanStudentAnnual" type="number" placeholder="99" />
          </view>
        </view>
        <view style="margin-top:12rpx;">
          <text style="font-size:22rpx;color:#999;font-weight:700;">可用功能（点击切换）</text>
          <view style="display:flex;flex-wrap:wrap;gap:8rpx;margin-top:8rpx;">
            <view
              v-for="f in ALL_FEATURES"
              :key="f"
              :class="['chip-v2', hasFeature(planKey, f) ? 'active' : '']"
              style="padding:6rpx 16rpx;font-size:20rpx;"
              @click="toggleFeature(planKey, f)"
            >{{ hasFeature(planKey, f) ? '✓' : '✗' }} {{ featureDisplayLabel(f) }}</view>
          </view>
        </view>
      </view>
    </view>

    <!-- 分享奖励 -->
    <view class="settings-section">
      <view class="section-head">
        <text class="section-title">分享奖励</text>
      </view>
      <view class="switch-row">
        <view>
          <text class="field-title">启用邀请奖励</text>
          <text class="field-desc">双方均获得额外 Crush Credits。被邀请人需创建 Crush 并记录事件后才发放。</text>
        </view>
        <switch :checked="subForm.referralEnabled" @change="subForm.referralEnabled = $event.detail.value" />
      </view>
      <view v-if="subForm.referralEnabled" class="form-grid" style="margin-top:16rpx;">
        <view class="field">
          <text>邀请人奖励（Crush Credits）</text>
          <input v-model.number="subForm.inviterRewardTokens" type="number" placeholder="3000" />
        </view>
        <view class="field">
          <text>被邀请人奖励（Crush Credits）</text>
          <input v-model.number="subForm.inviteeRewardTokens" type="number" placeholder="5000" />
        </view>
        <view class="field">
          <text>单周邀请上限</text>
          <input v-model.number="subForm.weeklyInviteCap" type="number" placeholder="5" />
        </view>
      </view>
      <view v-if="subForm.referralEnabled" class="switch-row" style="margin-top:16rpx;">
        <view>
          <text class="field-title">要求首条事件后发奖</text>
          <text class="field-desc">开启后，被邀请人需先创建时间轴事件，后台 worker 才发放奖励。</text>
        </view>
        <switch :checked="subForm.requireFirstEvent" @change="subForm.requireFirstEvent = $event.detail.value" />
      </view>
      <view v-if="subForm.referralEnabled" class="switch-row" style="margin-top:16rpx;">
        <view>
          <text class="field-title">暂停后台邀请奖励</text>
          <text class="field-desc">暂停后台邀请奖励，不影响注册、登录和记录创建。</text>
        </view>
        <switch :checked="subForm.payoutPaused" @change="subForm.payoutPaused = $event.detail.value" />
      </view>
    </view>

    <view class="settings-section">
      <view class="section-head">
        <text class="section-title">AI 预估消耗</text>
      </view>
      <text class="field-desc" style="display:block;margin-bottom:16rpx;">门槛按预估值乘当前模型扣费倍率计算。</text>
      <view class="form-grid">
        <view v-for="item in FEATURE_ESTIMATE_FIELDS" :key="item.key" class="field">
          <text>{{ item.label }}</text>
          <input v-model.number="subForm.featureEstTokens[item.key]" type="number" :placeholder="String(item.defaultValue)" />
        </view>
      </view>
    </view>

    <view v-if="subSaveMsg" class="save-message">{{ subSaveMsg }}</view>
    <button class="primary-btn" :disabled="subSaving" @click="saveSubscriptionConfig">
      {{ subSaving ? '保存中...' : '保存订阅配置' }}
    </button>
  </view>
</template>

<script setup lang="ts">
// 订阅配置面板 —— 自 admin.vue 抽出。自包含（保存消息用本地 subSaveMsg，无共享 error 依赖）。
import { ref, reactive, onMounted } from 'vue'
import { adminGetSubscriptionConfig, adminUpdateSubscriptionConfig } from '@/utils/api'
import { aiLabel } from '@/utils/labels'

const FEATURE_ESTIMATE_FIELDS = [
  { key: 'initial_assessment_text', label: '首次文本分析', defaultValue: 800 },
  { key: 'batchTag', label: '批量事件理解', defaultValue: 800 },
  { key: 'eventAssessment', label: '即时事件分析', defaultValue: 2000 },
  { key: 'attachmentAnalysis', label: '微信截图识别', defaultValue: 1000 },
  { key: 'quickRead', label: '快速解读', defaultValue: 800 },
  { key: 'pairRead', label: '桃花匹配解读', defaultValue: 2000 },
  { key: 'sideRead', label: '星象速写', defaultValue: 1500 },
  { key: 'weeklyReview', label: '周复盘', defaultValue: 2000 },
  { key: 'petReply', label: '小咪单句回复', defaultValue: 700 },
  { key: 'petReplyStrategy', label: '小咪多轮策略', defaultValue: 1200 },
  { key: 'petQaSingle', label: '小咪问答单条', defaultValue: 300 },
  { key: 'petQaGeneration', label: '小咪问答多策略', defaultValue: 600 },
  { key: 'petChat', label: '小咪普通聊天', defaultValue: 700 }
]

const subForm = reactive({
  trialEnabled: true,
  trialDurationDays: 7,
  trialExtendOnReferral: 3,
  trialFeatures: [] as string[],
  trialExcludedFeatures: [] as string[],
  plans: {
    free: { name: '免费版', monthlyTokens: 30000, maxCrushes: 1, priceYuan: 0, priceYuanAnnual: 0, priceYuanStudent: 0, features: [] as string[], excludedFeatures: [] as string[] },
    pro: { name: 'Pro', monthlyTokens: 300000, maxCrushes: 3, priceYuan: 19, priceYuanAnnual: 168, priceYuanStudent: 12, priceYuanStudentAnnual: 99, features: [] as string[], excludedFeatures: [] as string[] },
    ultra: { name: 'Ultra', monthlyTokens: -1, maxCrushes: -1, priceYuan: 39, priceYuanAnnual: 298, priceYuanStudent: 25, priceYuanStudentAnnual: 199, features: [] as string[], excludedFeatures: [] as string[] }
  },
  referralEnabled: true,
  inviterRewardTokens: 3000,
  inviteeRewardTokens: 5000,
  weeklyInviteCap: 5,
  requireFirstEvent: true,
  payoutPaused: false,
  featureEstTokens: Object.fromEntries(FEATURE_ESTIMATE_FIELDS.map(item => [item.key, item.defaultValue]))
  ,heartPersona: { enabled: true, answerBeforePayEnabled: true, productionProductId: '', allowedFeatures: ['关系女主角', 'Crush名人图鉴', '次元角色图鉴'] }
}) as any
const ALL_FEATURES = [
  '记录', '时间轴', '规则分析', '即时反馈', '事件理解',
  '周复盘', '附件识别', '小咪帮你说（单轮）',
  '小咪多轮策略', '自定义宠物', '更换宠物', '自定义AI风格', '命理桃花',
  '关系女主角', 'Crush名人图鉴', '次元角色图鉴'
]
const SUMMARY_MARKERS = ['免费版全部', 'Pro全部']
const ARCHETYPE_FEATURES = ['关系女主角', 'Crush名人图鉴', '次元角色图鉴']
const FEATURE_DISPLAY_LABELS: Record<string, string> = {
  '关系女主角': '关系主角（含男主角 / 女主角）'
}
const featureDisplayLabel = (feature: string) => FEATURE_DISPLAY_LABELS[feature] || feature
const subSaving = ref(false)
const subSaveMsg = ref('')

function hasTrialFeature(f: string) {
  return !subForm.trialExcludedFeatures.includes(f)
}
function toggleTrialFeature(f: string) {
  if (hasTrialFeature(f)) {
    subForm.trialFeatures = subForm.trialFeatures.filter((x: string) => x !== f)
    if (!subForm.trialExcludedFeatures.includes(f)) subForm.trialExcludedFeatures.push(f)
  } else {
    subForm.trialExcludedFeatures = subForm.trialExcludedFeatures.filter((x: string) => x !== f)
    if (!subForm.trialFeatures.includes(f)) subForm.trialFeatures.push(f)
  }
}
function hasFeature(planKey: string, f: string) {
  const plan = subForm.plans[planKey]
  return !plan.excludedFeatures.includes(f)
}
function toggleFeature(planKey: string, f: string) {
  const plan = subForm.plans[planKey]
  if (hasFeature(planKey, f)) {
    plan.features = plan.features.filter((x: string) => x !== f)
    if (!plan.excludedFeatures.includes(f)) plan.excludedFeatures.push(f)
  } else {
    plan.excludedFeatures = plan.excludedFeatures.filter((x: string) => x !== f)
    if (!plan.features.includes(f)) plan.features.push(f)
  }
}
function togglePaymentFeature(feature: string) {
  const list = subForm.heartPersona.allowedFeatures
  if (list.includes(feature)) subForm.heartPersona.allowedFeatures = list.filter((item: string) => item !== feature)
  else subForm.heartPersona.allowedFeatures = [...list, feature]
}

async function loadSubscriptionConfig() {
  subSaving.value = true
  try {
    const result = await adminGetSubscriptionConfig()
    if (!result?.success || !result?.config) return
    const c = result.config
    subForm.heartPersona.enabled = c.heartPersonaReportPayment?.enabled === true
    subForm.heartPersona.answerBeforePayEnabled = c.heartPersonaReportPayment?.answerBeforePayEnabled === true
    subForm.heartPersona.productionProductId = String(c.heartPersonaReportPayment?.productionProductId || '')
    subForm.heartPersona.allowedFeatures = Array.isArray(c.heartPersonaReportPayment?.allowedFeatures)
      ? c.heartPersonaReportPayment.allowedFeatures.filter((item: string) => ARCHETYPE_FEATURES.includes(item))
      : [...ARCHETYPE_FEATURES]
    subForm.trialEnabled = c.trial?.enabled !== false
    subForm.trialDurationDays = Number(c.trial?.durationDays ?? 7)
    subForm.trialExtendOnReferral = Number(c.trial?.extendOnReferral ?? 3)
    if (Array.isArray(c.trial?.features)) subForm.trialFeatures = c.trial.features.filter((f: string) => ALL_FEATURES.includes(f))
    if (Array.isArray(c.trial?.excludedFeatures)) subForm.trialExcludedFeatures = c.trial.excludedFeatures.filter((f: string) => ALL_FEATURES.includes(f))
    subForm.welcomeCalls = Number(c.welcomeCalls ?? 10)
    for (const item of FEATURE_ESTIMATE_FIELDS) {
      subForm.featureEstTokens[item.key] = numberOr(c.featureEstTokens?.[item.key], item.defaultValue)
    }
    if (c.plans) {
      for (const key of ['free', 'pro', 'ultra']) {
        if (c.plans[key]) {
          subForm.plans[key].name = c.plans[key].name || subForm.plans[key].name
          subForm.plans[key].monthlyTokens = Number(c.plans[key].monthlyTokens ?? subForm.plans[key].monthlyTokens)
          subForm.plans[key].maxCrushes = Number(c.plans[key].maxCrushes ?? subForm.plans[key].maxCrushes)
          if (Array.isArray(c.plans[key].features)) {
            const rawFeatures = c.plans[key].features
            const markers = rawFeatures.filter((f: string) => SUMMARY_MARKERS.includes(f))
            const regulars = rawFeatures.filter((f: string) => ALL_FEATURES.includes(f))
            subForm.plans[key].features = [...markers, ...regulars]
          }
          if (Array.isArray(c.plans[key].excludedFeatures)) subForm.plans[key].excludedFeatures = c.plans[key].excludedFeatures.filter((f: string) => ALL_FEATURES.includes(f))
          if (key !== 'free') {
            subForm.plans[key].priceYuan = Number(c.plans[key].priceYuan ?? subForm.plans[key].priceYuan)
            subForm.plans[key].priceYuanAnnual = Number(c.plans[key].priceYuanAnnual ?? subForm.plans[key].priceYuanAnnual)
            subForm.plans[key].priceYuanStudent = Number(c.plans[key].priceYuanStudent ?? subForm.plans[key].priceYuanStudent)
            subForm.plans[key].priceYuanStudentAnnual = Number(c.plans[key].priceYuanStudentAnnual ?? subForm.plans[key].priceYuanStudentAnnual)
          }
        }
      }
    }
    if (c.referral) {
      subForm.referralEnabled = c.referral.enabled !== false
      subForm.trialExtendOnReferral = Number(c.referral.inviterTrialExtendDays ?? subForm.trialExtendOnReferral)
      subForm.inviterRewardTokens = Number(c.referral.inviterRewardTokens ?? subForm.inviterRewardTokens)
      subForm.inviteeRewardTokens = Number(c.referral.inviteeRewardTokens ?? subForm.inviteeRewardTokens)
      subForm.weeklyInviteCap = Number(c.referral.weeklyInviteCap ?? 5)
      subForm.requireFirstEvent = c.referral.requireFirstEvent !== false
      subForm.payoutPaused = c.referral.payoutPaused === true
    }
  } catch { /* ignore */ }
  finally { subSaving.value = false }
}

function numberOr(value: any, fallback: number) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

async function saveSubscriptionConfig() {
  subSaving.value = true
  subSaveMsg.value = ''
  try {
    const result = await adminUpdateSubscriptionConfig({
      trial: {
        enabled: subForm.trialEnabled,
        durationDays: subForm.trialDurationDays,
        extendOnReferral: subForm.trialExtendOnReferral,
        features: [...subForm.trialFeatures],
        excludedFeatures: [...subForm.trialExcludedFeatures]
      },
      plans: {
        free: { name: subForm.plans.free.name, monthlyTokens: numberOr(subForm.plans.free.monthlyTokens, 30000), maxCrushes: numberOr(subForm.plans.free.maxCrushes, 1), features: [...subForm.plans.free.features], excludedFeatures: [...subForm.plans.free.excludedFeatures] },
        pro: { name: subForm.plans.pro.name, monthlyTokens: numberOr(subForm.plans.pro.monthlyTokens, 300000), maxCrushes: numberOr(subForm.plans.pro.maxCrushes, 3), priceYuan: numberOr(subForm.plans.pro.priceYuan, 19), priceYuanAnnual: numberOr(subForm.plans.pro.priceYuanAnnual, 168), priceYuanStudent: numberOr(subForm.plans.pro.priceYuanStudent, 12), priceYuanStudentAnnual: numberOr(subForm.plans.pro.priceYuanStudentAnnual, 99), features: [...subForm.plans.pro.features], excludedFeatures: [...subForm.plans.pro.excludedFeatures] },
        ultra: { name: subForm.plans.ultra.name, monthlyTokens: numberOr(subForm.plans.ultra.monthlyTokens, -1), maxCrushes: numberOr(subForm.plans.ultra.maxCrushes, -1), priceYuan: numberOr(subForm.plans.ultra.priceYuan, 39), priceYuanAnnual: numberOr(subForm.plans.ultra.priceYuanAnnual, 298), priceYuanStudent: numberOr(subForm.plans.ultra.priceYuanStudent, 25), priceYuanStudentAnnual: numberOr(subForm.plans.ultra.priceYuanStudentAnnual, 199), features: [...subForm.plans.ultra.features], excludedFeatures: [...subForm.plans.ultra.excludedFeatures] }
      },
      featureEstTokens: Object.fromEntries(FEATURE_ESTIMATE_FIELDS.map(item => [
        item.key,
        numberOr(subForm.featureEstTokens[item.key], item.defaultValue)
      ])),
      heartPersonaReportPayment: {
        enabled: subForm.heartPersona.enabled === true,
        answerBeforePayEnabled: subForm.heartPersona.answerBeforePayEnabled === true,
        productionProductId: String(subForm.heartPersona.productionProductId || ''),
        allowedFeatures: [...subForm.heartPersona.allowedFeatures],
        refundRevokesPurchase: true
      },
      referral: {
        enabled: subForm.referralEnabled,
        inviterTrialExtendDays: numberOr(subForm.trialExtendOnReferral, 0),
        inviterRewardTokens: numberOr(subForm.inviterRewardTokens, 3000),
        inviteeRewardTokens: numberOr(subForm.inviteeRewardTokens, 5000),
        weeklyInviteCap: numberOr(subForm.weeklyInviteCap, 5),
        requireFirstEvent: subForm.requireFirstEvent !== false,
        payoutPaused: subForm.payoutPaused === true
      }
    })
    if (!result?.success) {
      subSaveMsg.value = result?.message || '保存失败'
      return
    }
    subSaveMsg.value = '订阅配置已保存'
    setTimeout(() => { subSaveMsg.value = '' }, 3000)
  } catch (e: any) {
    subSaveMsg.value = e?.message || '保存失败'
  } finally {
    subSaving.value = false
  }
}

onMounted(() => { loadSubscriptionConfig() })
</script>

<style scoped lang="scss">
@import '../../styles/admin-common.scss';
</style>
