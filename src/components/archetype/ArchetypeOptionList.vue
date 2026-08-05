<template>
  <view class="option-list">
    <button
      v-for="option in options"
      :key="option.key"
      :class="['option-item', modelValue === option.key ? 'option-item--active' : '', option.key === 'U' ? 'option-item--unknown' : '']"
      :disabled="disabled"
      @click="$emit('update:modelValue', option.key)"
    >
      <text class="option-item__key">{{ option.key }}</text>
      <text class="option-item__text">{{ option.text }}</text>
    </button>
  </view>
</template>

<script setup lang="ts">
defineProps<{
  options: Array<{ key: string; text: string }>
  modelValue?: string
  disabled?: boolean
}>()

defineEmits<{ (event: 'update:modelValue', value: string): void }>()
</script>

<style scoped lang="scss">
@import '@/styles/campus-pop.scss';
.option-list { display:flex; flex-direction:column; gap:18rpx; }
.option-item { display:flex; align-items:center; gap:18rpx; min-height:92rpx; padding:18rpx 22rpx; border:var(--border-width-strong, 3rpx) solid var(--border, #111); border-radius:var(--shape-radius-inner, 0); background:var(--surface, #fff); box-shadow:var(--shadow-card, 6rpx 6rpx 0 #111); text-align:left; }
.option-item::after { border:0; }
.option-item--active { transform:translate(3rpx,3rpx); background:var(--brand-warm, #FFFBEB); box-shadow:3rpx 3rpx 0 var(--border, #111); }
.option-item--unknown { background:var(--surface-dim, #f9f9f9); color:var(--text-muted, #666); }
.option-item__key { display:flex; align-items:center; justify-content:center; width:48rpx; height:48rpx; flex:none; border:var(--border-width, 2rpx) solid var(--border, #111); border-radius:50%; background:var(--surface, #fff); font-weight:var(--font-weight-hero, $fw-hero); color:var(--text-main, #111); }
.option-item__text { flex:1; font-size:$fs-body; line-height:1.5; color:var(--text-main, #111); white-space:normal; }
</style>
