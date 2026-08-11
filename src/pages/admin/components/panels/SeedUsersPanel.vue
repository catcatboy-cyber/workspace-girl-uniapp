<template>
  <view class="panel">
    <view class="panel-head">
      <view>
        <text class="panel-title">种子用户</text>
        <text class="panel-meta">白名单用户可在「我」页看到【我的邀请】卡片（分佣结算对所有用户开放，此处仅控制入口可见性）</text>
      </view>
      <button class="ghost-btn wide-btn" :disabled="loading" @click="loadList">{{ loading ? '加载中' : '刷新' }}</button>
    </view>
    <view v-if="notice" class="ok-alert">{{ notice }}</view>

    <view class="form-card">
      <text class="form-title">添加种子用户</text>
      <view class="form-row">
        <input class="form-input" v-model="userId" placeholder="用户 ID（必填）" style="flex:1;" />
        <input class="form-input" v-model="note" placeholder="备注（可选）" style="flex:1;" />
        <button class="small-btn primary" :disabled="saving" @click="add">{{ saving ? '添加中...' : '添加' }}</button>
      </view>
    </view>

    <view v-if="items.length === 0 && !loading" class="empty">暂无种子用户。</view>
    <view v-else class="table" style="max-height:520px;overflow-y:auto;">
      <view class="table-row table-header">
        <text style="flex:1.5;">用户 ID</text>
        <text style="flex:1;">备注</text>
        <text style="width:140rpx;">添加时间</text>
        <text style="width:100rpx;">操作</text>
      </view>
      <view v-for="item in items" :key="item.userId" class="table-row">
        <text class="mono" style="flex:1.5;font-size:18rpx;word-break:break-all;">{{ item.userId }}</text>
        <text style="flex:1;font-size:20rpx;">{{ item.note || '-' }}</text>
        <text style="width:140rpx;font-size:20rpx;">{{ formatDate(item.createdAt) }}</text>
        <view style="width:100rpx;">
          <button class="mini-btn danger" @click="remove(item)">移除</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { adminListSeedUsers, adminAddSeedUser, adminRemoveSeedUser } from '@/utils/api'

const emit = defineEmits<{ error: [string] }>()

const items = ref<any[]>([])
const loading = ref(false)
const saving = ref(false)
const notice = ref('')
const userId = ref('')
const note = ref('')

function formatDate(value: string | null) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

async function loadList() {
  if (loading.value) return
  loading.value = true
  try {
    const result = await adminListSeedUsers({ page: 1, pageSize: 50 })
    if (result?.success) items.value = result.users || []
  } catch (e: any) {
    emit('error', e?.message || '加载失败')
  } finally {
    loading.value = false
  }
}

async function add() {
  if (saving.value) return
  if (!userId.value.trim()) {
    emit('error', '用户 ID 必填')
    return
  }
  saving.value = true
  try {
    const result = await adminAddSeedUser(userId.value.trim(), note.value.trim())
    if (result?.success) {
      notice.value = result.message || '已添加'
      emit('error', '')
      userId.value = ''
      note.value = ''
      await loadList()
    } else {
      emit('error', result?.message || '添加失败')
    }
  } catch (e: any) {
    emit('error', e?.message || '添加失败')
  } finally {
    saving.value = false
  }
}

async function remove(item: any) {
  const confirmed = await new Promise<boolean>((resolve) => {
    uni.showModal({ title: '移除种子用户', content: `确认移除 ${item.userId}？移除后该用户将看不到【我的邀请】卡片。`, success: (res: any) => resolve(!!res?.confirm), fail: () => resolve(false) })
  })
  if (!confirmed) return
  try {
    const result = await adminRemoveSeedUser(item.userId)
    if (result?.success) {
      notice.value = '已移除'
      emit('error', '')
      await loadList()
    } else {
      emit('error', result?.message || '移除失败')
    }
  } catch (e: any) {
    emit('error', e?.message || '移除失败')
  }
}

onMounted(() => { loadList() })
</script>

<style scoped>
.panel { background: #fbfdfb; border: 1px solid rgba(23, 35, 31, 0.08); border-radius: 8px; box-shadow: 0 12px 28px rgba(23, 35, 31, 0.06); padding: 20px; }
.panel-head { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; margin-bottom: 16px; }
.panel-title { display: block; font-size: 20px; font-weight: 700; }
.panel-meta { display: block; color: #68766f; font-size: 13px; line-height: 1.5; }
button { margin: 0; }
.ghost-btn { border-radius: 6px; font-size: 15px; width: 88px; height: 38px; line-height: 38px; color: #123c36; background: #eef6f2; border: 1px solid rgba(18, 60, 54, 0.18); }
.wide-btn { width: 104px; }
.small-btn { border-radius: 6px; font-size: 13px; width: auto; min-width: 74px; height: 34px; line-height: 34px; padding: 0 12px; color: #123c36; background: #fbfdfb; border: 1px solid rgba(18, 60, 54, 0.18); }
.small-btn.primary { color: #fff; background: #123c36; }
.mini-btn { border-radius: 4px; font-size: 12px; width: auto; min-width: 56px; height: 30px; line-height: 30px; padding: 0 8px; color: #9c2f22; background: #fff6f4; border: 1px solid rgba(156, 47, 34, 0.25); }
.form-card { padding: 16px; margin-bottom: 16px; background: #f4f8f5; border: 1px solid rgba(23, 35, 31, 0.08); border-radius: 8px; }
.form-title { display: block; font-size: 15px; font-weight: 700; margin-bottom: 12px; }
.form-input { width: 100%; box-sizing: border-box; height: 38px; line-height: 38px; padding: 0 12px; border: 1px solid rgba(18, 60, 54, 0.18); border-radius: 6px; background: #fff; font-size: 14px; }
.form-row { display: flex; gap: 10px; align-items: center; }
.ok-alert { padding: 10px 14px; margin-bottom: 12px; border-radius: 6px; color: #1d6b4a; background: #e6f6ee; font-size: 13px; }
.table { border: 1px solid rgba(23, 35, 31, 0.08); border-radius: 8px; overflow: hidden; }
.table-row { display: flex; gap: 12px; align-items: center; padding: 12px 14px; border-top: 1px solid rgba(23, 35, 31, 0.08); font-size: 14px; }
.table-row:first-child { border-top: 0; }
.table-header { color: #68766f; background: #f3f7f4; font-weight: 700; }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; user-select: text; -webkit-user-select: text; }
.empty { padding: 22px; color: #68766f; background: #f4f7f4; border-radius: 8px; text-align: center; }
</style>
