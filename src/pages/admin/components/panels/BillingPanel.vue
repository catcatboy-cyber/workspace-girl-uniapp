<template>
  <view class="panel">
    <view class="panel-head">
      <view>
        <text class="panel-title">Crush Credits 额度配置</text>
        <text class="panel-meta">管理首次赠送、充值档位、模型扣费倍率等计费规则。</text>
      </view>
    </view>

    <view class="switch-row">
      <view>
        <text class="field-title">首次赠送额度</text>
        <text class="field-desc">新用户注册后自动赠送。关闭则不再赠送。</text>
      </view>
      <switch :checked="billingForm.firstGiftEnabled" @change="onFirstGiftEnabledChange" />
    </view>
    <view v-if="billingForm.firstGiftEnabled" class="field">
      <text>赠送额度 (Crush Credits)</text>
      <input v-model.number="billingForm.welcomeTokens" type="number" placeholder="1000000" />
    </view>

    <view class="field">
      <text>1 元兑换额度 (Crush Credits)</text>
      <input v-model.number="billingForm.tokensPerYuan" type="number" placeholder="100000" />
    </view>

    <view class="switch-row">
      <view>
        <text class="field-title">启用虚拟支付</text>
        <text class="field-desc">开启后使用新的微信虚拟支付通道。关闭则回退到旧微信支付 V3。</text>
      </view>
      <switch :checked="billingForm.useVirtualPay" @change="billingForm.useVirtualPay = $event.detail.value" />
    </view>

    <view class="settings-section">
      <view class="section-head">
        <text class="section-title">充值档位</text>
        <button class="small-btn" @click="addRechargeTier">添加档位</button>
      </view>
      <view v-for="(tier, index) in rechargeTiers" :key="tier.id" class="model-card">
        <view class="model-head">
          <text class="model-title">{{ tier.name || '未命名档位' }}</text>
          <button class="small-btn danger" @click="removeRechargeTier(index)">删除</button>
        </view>
        <view class="form-grid">
          <view class="field">
            <text>档位 ID</text>
            <input v-model="tier.id" placeholder="p9_9" />
          </view>
          <view class="field">
            <text>名称</text>
            <input v-model="tier.name" placeholder="基础包" />
          </view>
          <view class="field">
            <text>价格 (分)</text>
            <input v-model.number="tier.priceFen" type="number" placeholder="990" />
          </view>
          <view class="field">
            <text>赠送额度</text>
            <input v-model.number="tier.bonusTokens" type="number" placeholder="0" />
          </view>
          <view class="field">
            <text>启用</text>
            <switch :checked="tier.enabled" @change="onTierEnabledChange(index, $event)" />
          </view>
        </view>
      </view>
      <view v-if="rechargeTiers.length === 0" class="empty">暂无充值档位，点击"添加档位"创建。</view>
    </view>

    <view class="settings-section">
      <view class="section-head">
        <text class="section-title">模型扣费倍率</text>
        <button class="small-btn" @click="addModelPricing">添加模型</button>
      </view>
      <view v-for="(mp, index) in modelPricing" :key="'mp-' + index" class="model-card">
        <view class="model-head">
          <text class="model-title">{{ mp.modelId || '新模型' }}</text>
          <button class="small-btn danger" @click="removeModelPricing(index)">删除</button>
        </view>
        <view class="form-grid">
          <view class="field">
            <text>模型 ID ( * 表示通配)</text>
            <input v-model="mp.modelId" placeholder="* 或 deepseek-chat" />
          </view>
          <view class="field">
            <text>扣费倍率</text>
            <input v-model.number="mp.costMultiplier" type="number" placeholder="1" step="0.01" />
          </view>
          <view class="field">
            <text>启用</text>
            <switch :checked="mp.enabled" @change="onModelPricingEnabledChange(index, $event)" />
          </view>
        </view>
      </view>
      <view v-if="modelPricing.length === 0" class="empty">暂无模型倍率配置，点击"添加模型"创建。</view>
    </view>

    <view class="settings-section">
      <view class="section-head">
        <text class="section-title">扣费策略</text>
      </view>
      <view class="form-grid">
        <view class="field">
          <text>Usage 缺失时的扣费策略</text>
          <view class="mode-toggles">
            <button
              v-for="opt in noUsageFallbackOptions"
              :key="opt.value"
              :class="['small-btn', billingForm.noUsageFallback === opt.value ? 'active' : '']"
              @click="billingForm.noUsageFallback = opt.value"
            >{{ opt.label }}</button>
          </view>
        </view>
        <view class="field">
          <text>余额不足时</text>
          <view class="mode-toggles">
            <button
              v-for="opt in insufficientModeOptions"
              :key="opt.value"
              :class="['small-btn', billingForm.insufficientBalanceMode === opt.value ? 'active' : '']"
              @click="billingForm.insufficientBalanceMode = opt.value"
            >{{ opt.label }}</button>
          </view>
        </view>
      </view>
    </view>

    <view v-if="saveMsg" class="save-message">{{ saveMsg }}</view>
    <button class="primary-btn" :disabled="billingSaving" @click="saveBillingSettings">
      {{ billingSaving ? '保存中...' : '保存额度配置' }}
    </button>

    <view class="settings-section" style="margin-top: 24px;">
      <view class="section-head">
        <text class="section-title">手动充值</text>
        <text class="section-desc">管理员直接给指定用户增减额度。正数充值，负数扣减（测试用）。</text>
      </view>
      <view class="form-grid">
        <view class="field">
          <text>目标用户 ID</text>
          <input v-model="manualRechargeUserId" placeholder="填写用户的 _id" />
        </view>
        <view class="field">
          <text>充值额度 (token)</text>
          <input v-model.number="manualRechargeAmount" type="number" placeholder="例如 500000" />
        </view>
        <view class="field wide">
          <text>备注</text>
          <input v-model="manualRechargeRemark" placeholder="管理员手动充值" />
        </view>
      </view>
      <button class="primary-btn" :disabled="manualRecharging" @click="doManualRecharge" style="margin-top: 12px;">
        {{ manualRecharging ? '充值中...' : '确认充值' }}
      </button>
      <text v-if="manualRechargeMsg" class="save-message" style="margin-top: 8px;">{{ manualRechargeMsg }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
// Token 额度配置面板 —— 自 admin.vue 抽出。
// 保存成功用本地 saveMsg 内联显示（原来用共享 saveMessage）；错误经 @error 上报顶栏；手动充值用本地 manualRechargeMsg。
// 原来靠 watch(activeTab) 懒加载，已改为 onMounted 自加载。
import { ref, reactive, onMounted } from 'vue'
import { adminGetBillingSettings, adminUpdateBillingSettings, adminManualRecharge } from '@/utils/api'
import { aiLabel } from '@/utils/labels'

const emit = defineEmits<{ error: [string] }>()

const billingLoading = ref(false)
const billingSaving = ref(false)
const saveMsg = ref('')
const billingForm = reactive({
  firstGiftEnabled: true,
  welcomeTokens: 1000000,
  tokensPerYuan: 100000,
  insufficientBalanceMode: 'block',
  noUsageFallback: 'zero',
  useVirtualPay: false
})
const rechargeTiers = ref<Array<{ id: string; name: string; priceFen: number; bonusTokens: number; enabled: boolean }>>([])
const modelPricing = ref<Array<{ modelId: string; costMultiplier: number; enabled: boolean }>>([])
const noUsageFallbackOptions = [
  { value: 'zero', label: '不扣费' },
  { value: 'fallback', label: '按 maxTokens 估算' },
  { value: 'fixed', label: '按固定额度' }
]
const insufficientModeOptions = [
  { value: 'block', label: '阻断调用' },
  { value: 'allow', label: '允许欠费' }
]

const manualRechargeUserId = ref('')
const manualRechargeAmount = ref(0)
const manualRechargeRemark = ref('')
const manualRecharging = ref(false)
const manualRechargeMsg = ref('')

function onFirstGiftEnabledChange(event: any) {
  billingForm.firstGiftEnabled = Boolean(event.detail?.value)
}

function onTierEnabledChange(index: number, event: any) {
  const val = event?.detail?.value
  if (rechargeTiers.value[index]) rechargeTiers.value[index].enabled = Boolean(val)
}

function onModelPricingEnabledChange(index: number, event: any) {
  const val = event?.detail?.value
  if (modelPricing.value[index]) modelPricing.value[index].enabled = Boolean(val)
}

async function loadBillingSettings() {
  if (billingLoading.value) return
  billingLoading.value = true
  try {
    const result = await adminGetBillingSettings()
    if (!result?.success) return
    const b = result.billing || {}
    billingForm.firstGiftEnabled = b.firstGiftEnabled !== false
    billingForm.welcomeTokens = Number(b.welcomeTokens ?? 1000000)
    billingForm.tokensPerYuan = Number(b.tokensPerYuan ?? 100000)
    billingForm.insufficientBalanceMode = b.insufficientBalanceMode || 'block'
    billingForm.noUsageFallback = b.noUsageFallback || 'zero'
    billingForm.useVirtualPay = b.useVirtualPay === true
    rechargeTiers.value = Array.isArray(b.rechargeTiers)
      ? b.rechargeTiers.map((t: any) => ({
          id: t.id || '',
          name: t.name || '',
          priceFen: Number(t.priceFen ?? 990),
          bonusTokens: Number(t.bonusTokens ?? 0),
          enabled: t.enabled !== false
        }))
      : []
    modelPricing.value = Array.isArray(b.modelPricing)
      ? b.modelPricing.map((m: any) => ({
          modelId: m.modelId || '*',
          costMultiplier: Number(m.costMultiplier ?? 1),
          enabled: m.enabled !== false
        }))
      : []
  } catch (e: any) {
    // silently fail on load error
  } finally {
    billingLoading.value = false
  }
}

async function saveBillingSettings() {
  billingSaving.value = true
  saveMsg.value = ''
  emit('error', '')
  try {
    const result = await adminUpdateBillingSettings({
      firstGiftEnabled: billingForm.firstGiftEnabled,
      welcomeTokens: billingForm.welcomeTokens,
      tokensPerYuan: billingForm.tokensPerYuan,
      rechargeTiers: rechargeTiers.value,
      modelPricing: modelPricing.value,
      insufficientBalanceMode: billingForm.insufficientBalanceMode,
      noUsageFallback: billingForm.noUsageFallback,
      useVirtualPay: billingForm.useVirtualPay
    })
    if (!result?.success) {
      emit('error', result?.message || '额度配置保存失败')
      return
    }
    saveMsg.value = '额度配置已保存'
    await loadBillingSettings()
  } catch (error: any) {
    emit('error', error?.message || '额度配置保存失败')
  } finally {
    billingSaving.value = false
  }
}

function addRechargeTier() {
  const nextId = 'p_' + Date.now()
  rechargeTiers.value.push({
    id: nextId,
    name: '',
    priceFen: 990,
    bonusTokens: 0,
    enabled: true
  })
}

function removeRechargeTier(index: number) {
  rechargeTiers.value.splice(index, 1)
}

function addModelPricing() {
  modelPricing.value.push({
    modelId: '',
    costMultiplier: 1,
    enabled: true
  })
}

function removeModelPricing(index: number) {
  modelPricing.value.splice(index, 1)
}

async function doManualRecharge() {
  const uid = manualRechargeUserId.value.trim()
  if (!uid) { manualRechargeMsg.value = '请输入目标用户 ID'; return }
  if (!manualRechargeAmount.value || manualRechargeAmount.value === 0) { manualRechargeMsg.value = '请输入有效额度（正数充值，负数扣减）'; return }
  manualRecharging.value = true
  manualRechargeMsg.value = ''
  try {
    const result = await adminManualRecharge(uid, manualRechargeAmount.value, manualRechargeRemark.value || undefined)
    if (!result?.success) { manualRechargeMsg.value = result?.message || '充值失败'; return }
    const label = manualRechargeAmount.value > 0 ? '充值成功' : '扣减成功'
    manualRechargeMsg.value = `${label}：${manualRechargeAmount.value.toLocaleString()} token → ${uid}`
    manualRechargeAmount.value = 0
    manualRechargeRemark.value = ''
  } catch (e: any) {
    manualRechargeMsg.value = e?.message || '充值失败'
  } finally {
    manualRecharging.value = false
  }
}

onMounted(() => { loadBillingSettings() })
</script>

<style scoped lang="scss">
@import '../../styles/admin-common.scss';

.mode-toggles { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 6px; }
</style>
