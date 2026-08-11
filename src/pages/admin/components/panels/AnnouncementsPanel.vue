<template>
  <view class="panel">
    <view class="panel-head">
      <view>
        <text class="panel-title">公告管理</text>
        <text class="panel-meta">发布系统公告：全员可见，或仅指定用户可见</text>
      </view>
      <button class="ghost-btn wide-btn" :disabled="loading" @click="loadList">{{ loading ? '加载中' : '刷新' }}</button>
    </view>
    <view v-if="notice" class="ok-alert">{{ notice }}</view>

    <!-- 发布表单 -->
    <view class="form-card">
      <text class="form-title">{{ editingId ? '编辑公告' : '发布新公告' }}</text>
      <input class="form-input" v-model="form.title" placeholder="公告标题（必填）" />
      <textarea class="form-textarea" v-model="form.content" placeholder="公告内容（必填）" :maxlength="1000" />
      <view class="form-row">
        <text class="form-label">发送范围</text>
        <view class="radio-row">
          <view :class="['radio-item', form.targetType === 'all' ? 'active' : '']" @click="form.targetType = 'all'"><text>全员</text></view>
          <view :class="['radio-item', form.targetType === 'user' ? 'active' : '']" @click="form.targetType = 'user'"><text>指定用户</text></view>
        </view>
      </view>
      <input v-if="form.targetType === 'user'" class="form-input" v-model="form.targetUserId" placeholder="用户 ID（必填）" />
      <view class="form-row">
        <text class="form-label">有效期至（留空不限制）</text>
        <input class="form-input" v-model="form.expiresAt" placeholder="如 2026-12-31 23:59" />
      </view>
      <view class="form-actions">
        <button v-if="editingId" class="small-btn" @click="cancelEdit">取消编辑</button>
        <button class="small-btn primary" :disabled="saving" @click="save">{{ saving ? '保存中...' : editingId ? '保存修改' : '发布公告' }}</button>
      </view>
    </view>

    <!-- 公告列表 -->
    <view v-if="items.length === 0 && !loading" class="empty">暂无公告。</view>
    <view v-else class="table" style="max-height:520px;overflow-y:auto;">
      <view class="table-row table-header">
        <text style="width:140rpx;">状态</text>
        <text style="flex:1;">标题</text>
        <text style="width:160rpx;">范围</text>
        <text style="width:150rpx;">创建时间</text>
        <text style="width:160rpx;">操作</text>
      </view>
      <view v-for="item in items" :key="item._id" class="table-row">
        <text style="width:140rpx;font-weight:800;" :style="{ color: item.status === 'active' ? '#10B981' : '#999' }">{{ item.status === 'active' ? '发布中' : '已停用' }}</text>
        <text style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{{ item.title }}</text>
        <text style="width:160rpx;font-size:20rpx;">{{ item.targetType === 'user' ? '指定: ' + (item.targetUserId || '').slice(0, 10) : '全员' }}</text>
        <text style="width:150rpx;font-size:20rpx;">{{ formatDate(item.createdAt) }}</text>
        <view style="width:160rpx;display:flex;gap:6rpx;">
          <button class="mini-btn" @click="startEdit(item)">编辑</button>
          <button class="mini-btn" :class="item.status === 'active' ? 'danger' : ''" @click="toggleStatus(item)">
            {{ item.status === 'active' ? '停用' : '启用' }}
          </button>
          <button class="mini-btn danger" @click="remove(item)">删除</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { adminCreateAnnouncement, adminUpdateAnnouncementStatus, adminRemoveAnnouncement, adminListAnnouncements } from '@/utils/api'

const emit = defineEmits<{ error: [string] }>()

const items = ref<any[]>([])
const loading = ref(false)
const saving = ref(false)
const notice = ref('')
const editingId = ref('')
const form = ref({ title: '', content: '', targetType: 'all' as 'all' | 'user', targetUserId: '', expiresAt: '' })

function formatDate(value: string | null) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function resetForm() {
  editingId.value = ''
  form.value = { title: '', content: '', targetType: 'all', targetUserId: '', expiresAt: '' }
}

async function loadList() {
  if (loading.value) return
  loading.value = true
  try {
    const result = await adminListAnnouncements({ page: 1, pageSize: 50 })
    if (result?.success) items.value = result.announcements || []
  } catch (e: any) {
    emit('error', e?.message || '加载公告失败')
  } finally {
    loading.value = false
  }
}

async function save() {
  if (saving.value) return
  if (!form.value.title.trim() || !form.value.content.trim()) {
    emit('error', '标题和内容必填')
    return
  }
  if (form.value.targetType === 'user' && !form.value.targetUserId.trim()) {
    emit('error', '指定用户公告必须填写用户 ID')
    return
  }
  saving.value = true
  try {
    const expiresAt = form.value.expiresAt.trim()
      ? new Date(form.value.expiresAt.replace(' ', 'T')).toISOString()
      : null
    const result = await adminCreateAnnouncement({
      announcementId: editingId.value || undefined,
      title: form.value.title,
      content: form.value.content,
      targetType: form.value.targetType,
      targetUserId: form.value.targetUserId,
      expiresAt
    })
    if (result?.success) {
      notice.value = editingId.value ? '公告已更新' : '公告已发布'
      emit('error', '')
      resetForm()
      await loadList()
    } else {
      emit('error', result?.message || '发布失败')
    }
  } catch (e: any) {
    emit('error', e?.message || '发布失败')
  } finally {
    saving.value = false
  }
}

function startEdit(item: any) {
  editingId.value = item._id
  form.value = {
    title: item.title || '',
    content: item.content || '',
    targetType: item.targetType === 'user' ? 'user' : 'all',
    targetUserId: item.targetUserId || '',
    expiresAt: item.expiresAt ? new Date(item.expiresAt).toISOString().slice(0, 16) : ''
  }
}

function cancelEdit() {
  resetForm()
}

async function toggleStatus(item: any) {
  try {
    const next = item.status === 'active' ? 'disabled' : 'active'
    const result = await adminUpdateAnnouncementStatus(item._id, next)
    if (result?.success) {
      notice.value = next === 'active' ? '公告已启用' : '公告已停用'
      emit('error', '')
      await loadList()
    } else {
      emit('error', result?.message || '操作失败')
    }
  } catch (e: any) {
    emit('error', e?.message || '操作失败')
  }
}

async function remove(item: any) {
  const confirmed = await new Promise<boolean>((resolve) => {
    uni.showModal({ title: '删除公告', content: `确认删除「${item.title}」？删除后不可恢复。`, success: (res: any) => resolve(!!res?.confirm), fail: () => resolve(false) })
  })
  if (!confirmed) return
  try {
    const result = await adminRemoveAnnouncement(item._id)
    if (result?.success) {
      notice.value = '公告已删除'
      emit('error', '')
      await loadList()
    } else {
      emit('error', result?.message || '删除失败')
    }
  } catch (e: any) {
    emit('error', e?.message || '删除失败')
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
.small-btn.danger { color: #9c2f22; border-color: rgba(156, 47, 34, 0.25); background: #fff6f4; }
.mini-btn { border-radius: 4px; font-size: 12px; width: auto; min-width: 56px; height: 30px; line-height: 30px; padding: 0 8px; color: #123c36; background: #fbfdfb; border: 1px solid rgba(18, 60, 54, 0.18); }
.mini-btn.danger { color: #9c2f22; border-color: rgba(156, 47, 34, 0.25); background: #fff6f4; }
.form-card { padding: 16px; margin-bottom: 16px; background: #f4f8f5; border: 1px solid rgba(23, 35, 31, 0.08); border-radius: 8px; }
.form-title { display: block; font-size: 15px; font-weight: 700; margin-bottom: 12px; }
.form-input { width: 100%; box-sizing: border-box; height: 38px; line-height: 38px; padding: 0 12px; margin-bottom: 10px; border: 1px solid rgba(18, 60, 54, 0.18); border-radius: 6px; background: #fff; font-size: 14px; }
.form-textarea { width: 100%; box-sizing: border-box; min-height: 88px; padding: 10px 12px; margin-bottom: 10px; border: 1px solid rgba(18, 60, 54, 0.18); border-radius: 6px; background: #fff; font-size: 14px; }
.form-row { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
.form-label { font-size: 13px; color: #68766f; white-space: nowrap; }
.radio-row { display: flex; gap: 8px; }
.radio-item { padding: 4px 14px; border: 1px solid rgba(18, 60, 54, 0.18); border-radius: 6px; font-size: 13px; color: #123c36; background: #fff; }
.radio-item.active { background: #123c36; color: #fff; }
.form-actions { display: flex; gap: 8px; justify-content: flex-end; }
.ok-alert { padding: 10px 14px; margin-bottom: 12px; border-radius: 6px; color: #1d6b4a; background: #e6f6ee; font-size: 13px; }
.table { border: 1px solid rgba(23, 35, 31, 0.08); border-radius: 8px; overflow: hidden; }
.table-row { display: flex; gap: 12px; align-items: center; padding: 12px 14px; border-top: 1px solid rgba(23, 35, 31, 0.08); font-size: 14px; }
.table-row:first-child { border-top: 0; }
.table-header { color: #68766f; background: #f3f7f4; font-weight: 700; }
.empty { padding: 22px; color: #68766f; background: #f4f7f4; border-radius: 8px; text-align: center; }
</style>
